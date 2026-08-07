import { useEffect, useMemo, useState } from 'react';
import { listTimesheetPeriods, getTimesheetPeriod, approvePeriod, lockPeriod, listDisputes, resolveDispute, exportTimesheetPeriod } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, minutesToHours, formatDate } from '../api/format.js';
import { Panel, PanelTitle, StatCard, Tag, Avatar, Button, TableWrap, Th, Td, Row, SegTabs } from '../ds/console.jsx';

const h = (m) => minutesToHours(m ?? 0);

export default function TimesheetsPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  async function load(periodId) {
    const [ps, ds] = await Promise.all([listTimesheetPeriods(), listDisputes()]);
    setPeriods(ps); setDisputes(ds);
    const target = periodId ?? selected?.id ?? ps[0]?.id;
    if (target) setSelected(await getTimesheetPeriod(target));
  }
  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApprove() { setBusy(true); try { await approvePeriod(selected.id); toast.success('Period approved, ready for payroll'); await load(selected.id); } catch (e) { toast.error(e.message); } finally { setBusy(false); } }
  async function handleLock() { setBusy(true); try { await lockPeriod(selected.id); toast.success('Period locked'); await load(selected.id); } catch (e) { toast.error(e.message); } finally { setBusy(false); } }
  async function handleResolveDispute(d) { try { await resolveDispute(d.id, 'Checked against the original clock records'); toast.success('Query resolved'); await load(); } catch (e) { toast.error(e.message); } }
  async function handleExport(type) { try { await exportTimesheetPeriod(selected.id, type); toast.success(`${type.toUpperCase()} export downloaded`); } catch (e) { toast.error(e.message || 'Export failed'); } }

  // Aggregate the period's lines per carer.
  const carers = useMemo(() => {
    const lines = selected?.lines ?? [];
    const map = new Map();
    for (const l of lines) {
      const key = l.employee?.id ?? 'unknown';
      const g = map.get(key) ?? { employee: l.employee, worked: 0, scheduled: 0, breaks: 0, flagged: 0, lines: [] };
      g.worked += l.worked_minutes ?? 0; g.scheduled += l.scheduled_minutes ?? 0; g.breaks += l.break_minutes ?? 0;
      g.flagged += (l.flags ?? []).length; g.lines.push(l);
      map.set(key, g);
    }
    const status = selected?.status;
    return [...map.values()].map((g) => ({
      ...g,
      overtime: Math.max(g.worked - g.scheduled, 0),
      state: status === 'approved' || status === 'locked' ? 'approved' : g.flagged > 0 ? 'blocked' : 'ready',
    })).sort((a, b) => fullName(a.employee).localeCompare(fullName(b.employee)));
  }, [selected]);

  if (loading) return <Spinner fullscreen />;

  const totalWorked = carers.reduce((a, c) => a + c.worked, 0);
  const totalOt = carers.reduce((a, c) => a + c.overtime, 0);
  const ready = carers.filter((c) => c.state === 'ready').length;
  const blocked = carers.filter((c) => c.state === 'blocked').length;
  const openDisputes = disputes.filter((d) => d.state === 'open');
  const rows = filter === 'all' ? carers : carers.filter((c) => c.state === filter);

  const STATE_TONE = { ready: 'primary', blocked: 'danger', approved: 'success' };
  const STATE_LABEL = { ready: 'Ready for approval', blocked: 'Blocked', approved: 'Approved' };
  const periodTabs = periods.map((p) => ({ key: p.id, label: formatDate(p.starts_on), icon: p.status === 'locked' ? 'shield' : p.status === 'approved' ? 'check' : 'calendar' }));
  const filterTabs = [
    { key: 'all', label: 'All', icon: 'menu', count: carers.length },
    { key: 'ready', label: 'Ready', icon: 'check', count: ready },
    { key: 'blocked', label: 'Blocked', icon: 'alert', count: blocked },
    { key: 'approved', label: 'Approved', icon: 'shield', count: carers.filter((c) => c.state === 'approved').length },
  ];

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Period picker */}
      {periods.length > 0 && <SegTabs active={selected?.id} onSelect={(id) => getTimesheetPeriod(id).then(setSelected)} tabs={periodTabs} />}

      {selected && (
        <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:0 4px')}>
          <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted)')}>{formatDate(selected.starts_on)} to {formatDate(selected.ends_on)}</div>
          <div style={s('flex:1')} />
          {canManage && selected.status === 'open' && <Button variant="primary" icon="check" onClick={busy ? undefined : handleApprove}>{busy ? '…' : `Approve ${ready} ready`}</Button>}
          {canManage && selected.status === 'approved' && <Button icon="shield" onClick={busy ? undefined : handleLock}>Lock period</Button>}
        </div>
      )}

      {/* Stat cards */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        <StatCard label="Verified hours" value={h(totalWorked)} hint={`Across ${carers.length} carers`} tone="primary" icon="clock" />
        <StatCard label="Overtime" value={h(totalOt)} hint="Worked beyond scheduled" tone="magenta" icon="alert" />
        <StatCard label="Ready to approve" value={ready} hint="All entries verified" tone="success" icon="check" />
        <StatCard label="Blocked" value={blocked} hint="Unresolved exceptions" tone="danger" icon="shield" />
      </div>

      {/* Carer queries */}
      {openDisputes.length > 0 && (
        <Panel style={{ background: 'var(--d-warn-bg)' }}>
          <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:10px')}>
            <div style={s('width:36px;height:36px;border-radius:12px;background:var(--d-warn-icon);display:flex;align-items:center;justify-content:center;color:var(--d-warn-ink)')}><Icon name="alert" size={18} /></div>
            <div style={s('font-size:14px;font-weight:700;color:var(--d-warn-ink)')}>{openDisputes.length} {openDisputes.length === 1 ? 'query' : 'queries'} from carers</div>
          </div>
          <div style={s('display:flex;flex-direction:column;gap:8px')}>
            {openDisputes.map((d) => (
              <div key={d.id} style={s('display:flex;align-items:center;gap:14px;background:var(--d-card);border-radius:14px;padding:11px 14px')}>
                <div style={s('flex:1;min-width:0;font-size:13px;font-weight:500;color:var(--d-ink2)')}><b style={s('font-weight:700;color:var(--d-ink)')}>{fullName(d.employee)}</b>: {d.reason}</div>
                <Button size="sm" variant="primary" onClick={() => handleResolveDispute(d)}>Mark resolved</Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Table + aside */}
      <div style={{ ...s('display:grid;gap:16px;align-items:start'), gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
        <div style={s('display:flex;flex-direction:column;gap:12px;min-width:0')}>
          <SegTabs tabs={filterTabs} active={filter} onSelect={setFilter} />
          <div style={s('background:var(--d-card);border-radius:20px;padding:12px 14px;overflow:auto')}>
            {rows.length === 0 ? (
              <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>Nothing in this period.<div style={s('font-size:12.5px;font-weight:500;color:var(--d-faint);margin-top:4px')}>Lines appear once visits are completed.</div></div>
            ) : (
              <TableWrap minWidth={820}>
                <thead><tr><Th>Carer</Th><Th align="right">Scheduled</Th><Th align="right">Worked</Th><Th align="right">Breaks</Th><Th align="right">Overtime</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <Row key={c.employee?.id} onClick={() => setDetail(c)}>
                      <Td><span style={s('display:inline-flex;align-items:center;gap:11px')}><Avatar initials={(c.employee?.first_name?.[0] ?? '') + (c.employee?.last_name?.[0] ?? '')} size="sm" /><b style={s('font-weight:700;color:var(--d-ink)')}>{fullName(c.employee)}</b></span></Td>
                      <Td align="right" mono>{h(c.scheduled)}</Td>
                      <Td align="right" mono><b style={s('font-weight:700;color:var(--d-ink)')}>{h(c.worked)}</b></Td>
                      <Td align="right" mono>{h(c.breaks)}</Td>
                      <Td align="right" mono>{c.overtime > 0 ? <span style={s('color:var(--d-magenta);font-weight:700')}>{h(c.overtime)}</span> : '–'}</Td>
                      <Td><Tag tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Tag></Td>
                    </Row>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
          <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);line-height:1.6;padding:0 4px')}>Approving marks the hours as checked. Locking prevents further edits and is the point at which the period goes to payroll. Neither changes the underlying clock records.</div>
        </div>

        {/* Aside */}
        <div style={s('display:flex;flex-direction:column;gap:16px')}>
          <Panel>
            <PanelTitle hint="This pay period">Approval progress</PanelTitle>
            {(() => {
              const approved = carers.filter((c) => c.state === 'approved').length;
              const total = Math.max(carers.length, 1);
              const seg = [['Approved', approved, 'var(--d-ok-ink)'], ['Ready', ready, 'var(--d-primary)'], ['Blocked', blocked, 'var(--d-danger-ink)']];
              return (
                <>
                  <div style={s('display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--d-panel)')}>
                    {seg.map(([l, v, c]) => v > 0 && <div key={l} style={{ width: `${(v / total) * 100}%`, background: c }} />)}
                  </div>
                  <div style={s('display:flex;flex-wrap:wrap;gap:12px;margin-top:10px')}>
                    {seg.map(([l, v, c]) => (
                      <span key={l} style={s('display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--d-ink2)')}><span style={{ ...s('width:8px;height:8px;border-radius:50%'), background: c }} />{l} <b className="d-num">{v}</b></span>
                    ))}
                  </div>
                </>
              );
            })()}
          </Panel>

          <Panel>
            <PanelTitle hint="Resolve these before payroll runs">Blockers</PanelTitle>
            {blocked === 0 ? (
              <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Nothing blocking payroll.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:8px')}>
                {carers.filter((c) => c.state === 'blocked').map((c) => (
                  <div key={c.employee?.id} onClick={() => setDetail(c)} className="hv" style={{ ...s('background:var(--d-danger-bg);border-radius:12px;padding:11px 13px;cursor:pointer'), '--hbg': 'var(--d-danger-bg2)' }}>
                    <div style={s('font-size:12.5px;font-weight:700;color:var(--d-danger-ink)')}>{fullName(c.employee)}</div>
                    <div style={s('font-size:11px;font-weight:500;color:var(--d-danger-ink);opacity:0.85;margin-top:2px')}>{[...new Set(c.lines.flatMap((l) => l.flags ?? []))].map((f) => f.replace(/_/g, ' ')).join(', ') || 'Unverified entry'}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle hint="Verified hours only — blocked lines excluded">Export presets</PanelTitle>
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <button type="button" onClick={() => handleExport('csv')} className="hv" style={{ ...s('display:flex;align-items:center;gap:10px;border:1px solid var(--d-border);border-radius:12px;padding:11px 13px;cursor:pointer;background:transparent;text-align:left;font-size:12.5px;font-weight:600;color:var(--d-ink);width:100%'), '--hbg': 'var(--d-panel)', fontFamily: 'inherit' }}><Icon name="download" size={16} style={{ color: 'var(--d-primary)' }} />CSV for payroll</button>
              <button type="button" onClick={() => handleExport('xlsx')} className="hv" style={{ ...s('display:flex;align-items:center;gap:10px;border:1px solid var(--d-border);border-radius:12px;padding:11px 13px;cursor:pointer;background:transparent;text-align:left;font-size:12.5px;font-weight:600;color:var(--d-ink);width:100%'), '--hbg': 'var(--d-panel)', fontFamily: 'inherit' }}><Icon name="download" size={16} style={{ color: 'var(--d-primary)' }} />Excel workbook (XLSX)</button>
            </div>
          </Panel>
        </div>
      </div>

      {/* Carer detail drawer */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:460px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 16px;border-bottom:1px solid var(--d-border);display:flex;align-items:center;gap:12px')}>
              <Avatar initials={(detail.employee?.first_name?.[0] ?? '') + (detail.employee?.last_name?.[0] ?? '')} />
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:17px;font-weight:700;color:var(--d-ink)')}>{fullName(detail.employee)}</div>
                <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{h(detail.worked)} worked · {detail.lines.length} visits</div>
              </div>
              <div onClick={() => setDetail(null)} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:16px 22px;display:flex;flex-direction:column;gap:8px')}>
              {detail.lines.map((l, i) => {
                const diff = (l.worked_minutes ?? 0) - (l.scheduled_minutes ?? 0);
                return (
                  <div key={i} style={s('background:var(--d-panel);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px')}>
                    <div style={s('flex:1;min-width:0')}>
                      <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{formatDate(l.work_date)}</div>
                      <div className="d-num" style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>Scheduled {h(l.scheduled_minutes)} · worked {h(l.worked_minutes)}</div>
                      {(l.flags ?? []).length > 0 && <div style={s('display:flex;gap:5px;margin-top:5px')}>{l.flags.map((f) => <Tag key={f} tone="warning">{f.replace(/_/g, ' ')}</Tag>)}</div>}
                    </div>
                    <div className="d-num" style={{ ...s('font-size:12.5px;font-weight:700'), color: diff === 0 ? 'var(--d-muted)' : diff > 0 ? 'var(--d-ok-ink)' : 'var(--d-danger-ink)' }}>{diff === 0 ? 'on time' : `${diff > 0 ? '+' : ''}${diff}m`}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
