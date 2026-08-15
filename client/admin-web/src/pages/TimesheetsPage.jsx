import { useEffect, useMemo, useState } from 'react';
import { listTimesheetPeriods, getTimesheetPeriod, exportTimesheetPeriod } from '../api/index.js';
// PHASE 2 — PAYROLL. Approval / locking / dispute resolution belong to the
// payroll module, which isn't built yet. The imports and the flows that use them
// are commented out below (search "PHASE 2") rather than deleted, so wiring them
// back is a one-block change once payroll lands. Until then this page is a
// read-only view of verified hours per carer, per period.
// import { approvePeriod, approveCarerLines, lockPeriod, listDisputes, resolveDispute } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { minutesToHours, formatDate } from '../api/format.js';
import { Panel, PanelTitle, StatCard, Tag, Avatar, Button, TableWrap, Th, Td, Row } from '../ds/console.jsx';

const h = (m) => minutesToHours(m ?? 0);
const initials = (name) => (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const periodLabel = (p) => (p ? `${formatDate(p.starts_on)} – ${formatDate(p.ends_on)}` : '');

export default function TimesheetsPage() {
  const toast = useToast();
  const [periods, setPeriods] = useState([]);      // list newest-first, for the stepper + dropdown
  const [selected, setSelected] = useState(null);  // full period with lines
  const [loading, setLoading] = useState(true);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const ps = await listTimesheetPeriods();
      // Newest first so stepping "back" walks into history.
      const sorted = [...ps].sort((a, b) => new Date(b.starts_on) - new Date(a.starts_on));
      if (!active) return;
      setPeriods(sorted);
      if (sorted[0]) setSelected(await getTimesheetPeriod(sorted[0].id));
    })().finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function pick(id) {
    setJumpOpen(false);
    setSelected(await getTimesheetPeriod(id));
  }

  // Index of the current period within the (newest-first) list drives the stepper.
  const idx = useMemo(() => periods.findIndex((p) => p.id === selected?.id), [periods, selected]);
  const hasNewer = idx > 0;                       // more recent period exists
  const hasOlder = idx >= 0 && idx < periods.length - 1;

  // One row per carer for the period, aggregated from the lines. Pure attendance:
  // scheduled vs worked vs breaks vs overtime, plus any exception flags as info.
  const carers = useMemo(() => {
    const lines = selected?.lines ?? [];
    const map = new Map();
    for (const l of lines) {
      const key = l.employee_id ?? 'unknown';
      const g = map.get(key) ?? { employeeId: key, worked: 0, scheduled: 0, breaks: 0, flagged: 0, lines: [] };
      g.worked += l.worked_minutes ?? 0; g.scheduled += l.scheduled_minutes ?? 0; g.breaks += l.break_minutes ?? 0;
      g.flagged += (l.flags ?? []).length; g.lines.push(l);
      map.set(key, g);
    }
    const roll = new Map((selected?.carers ?? []).map((c) => [c.employee_id, c.employee_name]));
    return [...map.values()]
      .map((g) => ({ ...g, name: roll.get(g.employeeId) ?? 'Unknown carer', overtime: Math.max(g.worked - g.scheduled, 0) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selected]);

  async function handleExport(type) {
    try { await exportTimesheetPeriod(selected.id, type); toast.success(`${type.toUpperCase()} hours downloaded`); }
    catch (e) { toast.error(e.message || 'Export failed'); }
  }

  if (loading) return <Spinner fullscreen />;

  if (!selected) {
    return (
      <Panel style={{ padding: '48px 24px' }}>
        <div style={s('text-align:center;font-size:14px;font-weight:600;color:var(--d-muted)')}>No timesheet periods yet.
          <div style={s('font-size:12.5px;font-weight:500;color:var(--d-faint);margin-top:6px')}>Periods appear once visits are completed and rolled up.</div>
        </div>
      </Panel>
    );
  }

  const totalWorked = carers.reduce((a, c) => a + c.worked, 0);
  const totalScheduled = carers.reduce((a, c) => a + c.scheduled, 0);
  const totalOt = carers.reduce((a, c) => a + c.overtime, 0);
  const withFlags = carers.filter((c) => c.flagged > 0).length;
  const q = query.trim().toLowerCase();
  const rows = q ? carers.filter((c) => c.name.toLowerCase().includes(q)) : carers;

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Period navigator — stepper + jump dropdown. Scales to any amount of
          history: one period on screen, arrows to step, dropdown to jump. */}
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--d-card);border-radius:20px;padding:12px 16px')}>
        <Button size="sm" icon="chevronLeft" disabled={!hasOlder} onClick={() => hasOlder && pick(periods[idx + 1].id)}>Older</Button>
        <div style={s('position:relative;flex:1;min-width:200px')}>
          <div onClick={() => setJumpOpen((v) => !v)} className="hv"
            style={{ ...s('display:flex;align-items:center;gap:10px;justify-content:center;cursor:pointer;border-radius:14px;padding:8px 14px'), '--hbg': 'var(--d-panel)' }}>
            <Icon name="calendar" size={16} />
            <span style={s('font-size:15px;font-weight:700;color:var(--d-ink);letter-spacing:-0.2px')}>{periodLabel(selected)}</span>
            <Icon name="chevronDown" size={15} style={{ transform: jumpOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </div>
          {jumpOpen && (
            <div style={s('position:absolute;top:46px;left:50%;transform:translateX(-50%);width:min(320px,90vw);max-height:320px;overflow-y:auto;background:var(--d-card);border:1px solid var(--d-border);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.22);padding:6px;z-index:60')}>
              {periods.map((p) => (
                <div key={p.id} onClick={() => pick(p.id)} className={p.id === selected.id ? '' : 'hv'}
                  style={{ ...s('display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;cursor:pointer;font-size:13px;font-weight:600'), background: p.id === selected.id ? 'var(--d-panel)' : 'transparent', color: 'var(--d-ink)', '--hbg': 'var(--d-panel)' }}>
                  <Icon name="calendar" size={14} />
                  <span style={s('flex:1;min-width:0')}>{periodLabel(p)}</span>
                  {p.id === selected.id && <Icon name="check" size={14} />}
                </div>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" onClick={() => hasNewer && pick(periods[idx - 1].id)} disabled={!hasNewer}>Newer <Icon name="chevronRight" size={14} /></Button>
      </div>

      {/* Hours summary — attendance, not pay. */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px')}>
        <StatCard label="Verified hours" value={h(totalWorked)} hint={`Across ${carers.length} carer${carers.length === 1 ? '' : 's'}`} tone="primary" icon="clock" />
        <StatCard label="Scheduled hours" value={h(totalScheduled)} hint="Planned for this period" tone="info" icon="calendar" />
        <StatCard label="Overtime" value={h(totalOt)} hint="Worked beyond scheduled" tone="magenta" icon="trend" />
        <StatCard label="Flagged entries" value={withFlags} hint="Carers with a review flag" tone={withFlags > 0 ? 'warning' : 'success'} icon="alert" />
      </div>

      {/* PHASE 2 — PAYROLL. The approval/lock action bar, the carer-queries
          (disputes) banner, and the "Approval progress" / "Blockers" panels are
          the payroll sign-off flow. Commented out until the payroll module
          exists; the read-only hours view above/below stays live.

      {selected.status === 'open' && canManage && (
        <div style={s('display:flex;align-items:center;gap:12px')}>
          <Button variant="primary" icon="check" onClick={handleApprove}>Approve {ready} ready</Button>
          {selected.status === 'approved' && <Button icon="shield" onClick={handleLock}>Lock period</Button>}
        </div>
      )}
      {openDisputes.length > 0 && ( ... carer queries banner + resolveDispute ... )}
      <Panel><PanelTitle>Approval progress</PanelTitle> ... approved/ready/blocked bar ...</Panel>
      <Panel><PanelTitle>Blockers before payroll runs</PanelTitle> ... </Panel>
      */}

      {/* Hours table + export aside */}
      <div style={{ ...s('display:grid;gap:16px;align-items:start'), gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div style={s('display:flex;flex-direction:column;gap:12px;min-width:0')}>
          <div style={s('height:44px;background:var(--d-card);border-radius:22px;display:flex;align-items:center;gap:9px;padding:0 16px')}>
            <Icon name="search" size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a carer"
              style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
          </div>
          <div style={s('background:var(--d-card);border-radius:20px;padding:12px 14px;overflow:auto')}>
            {rows.length === 0 ? (
              <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>{q ? 'No carer matches.' : 'No hours in this period.'}
                {!q && <div style={s('font-size:12.5px;font-weight:500;color:var(--d-faint);margin-top:4px')}>Lines appear once visits are completed.</div>}
              </div>
            ) : (
              <TableWrap minWidth={720}>
                <thead><tr><Th>Carer</Th><Th align="right">Scheduled</Th><Th align="right">Worked</Th><Th align="right">Breaks</Th><Th align="right">Overtime</Th><Th align="right">Visits</Th><Th /></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <Row key={c.employeeId} onClick={() => setDetail(c)}>
                      <Td>
                        <span style={s('display:inline-flex;align-items:center;gap:11px')}>
                          <Avatar initials={initials(c.name)} size="sm" />
                          <span>
                            <b style={s('font-weight:700;color:var(--d-ink);display:block')}>{c.name}</b>
                            {c.flagged > 0 && <span style={s('font-size:11px;font-weight:600;color:var(--d-warn-ink)')}>{c.flagged} flagged</span>}
                          </span>
                        </span>
                      </Td>
                      <Td align="right" mono>{h(c.scheduled)}</Td>
                      <Td align="right" mono><b style={s('font-weight:700;color:var(--d-ink)')}>{h(c.worked)}</b></Td>
                      <Td align="right" mono>{h(c.breaks)}</Td>
                      <Td align="right" mono>{c.overtime > 0 ? <span style={s('color:var(--d-magenta);font-weight:700')}>{h(c.overtime)}</span> : '–'}</Td>
                      <Td align="right" mono>{c.lines.length}</Td>
                      <Td align="right"><Icon name="chevronRight" size={15} style={{ color: 'var(--d-faint)' }} /></Td>
                    </Row>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
          <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);line-height:1.6;padding:0 4px')}>Hours are read straight from verified clock records — this view never changes them. Approval, locking and payroll export arrive in phase 2.</div>
        </div>

        {/* Export aside — attendance hours, not payroll. */}
        <div style={s('display:flex;flex-direction:column;gap:16px')}>
          <Panel>
            <PanelTitle hint="Verified hours for this period">Export hours</PanelTitle>
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              <button type="button" onClick={() => handleExport('csv')} className="hv" style={{ ...s('display:flex;align-items:center;gap:10px;border:1px solid var(--d-border);border-radius:12px;padding:11px 13px;cursor:pointer;background:transparent;text-align:left;font-size:12.5px;font-weight:600;color:var(--d-ink);width:100%'), '--hbg': 'var(--d-panel)', fontFamily: 'inherit' }}><Icon name="download" size={16} style={{ color: 'var(--d-primary)' }} />CSV</button>
              <button type="button" onClick={() => handleExport('xlsx')} className="hv" style={{ ...s('display:flex;align-items:center;gap:10px;border:1px solid var(--d-border);border-radius:12px;padding:11px 13px;cursor:pointer;background:transparent;text-align:left;font-size:12.5px;font-weight:600;color:var(--d-ink);width:100%'), '--hbg': 'var(--d-panel)', fontFamily: 'inherit' }}><Icon name="download" size={16} style={{ color: 'var(--d-primary)' }} />Excel (XLSX)</button>
            </div>
          </Panel>

          <Panel>
            <PanelTitle hint="This period at a glance">Totals</PanelTitle>
            <div style={s('display:flex;flex-direction:column;gap:10px')}>
              {[['Carers', carers.length], ['Scheduled', h(totalScheduled)], ['Worked', h(totalWorked)], ['Overtime', h(totalOt)]].map(([l, v]) => (
                <div key={l} style={s('display:flex;align-items:center;justify-content:space-between')}>
                  <span style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{l}</span>
                  <span className="d-num" style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Carer detail drawer — per-visit hours breakdown for the period. */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:460px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 16px;border-bottom:1px solid var(--d-border);display:flex;align-items:center;gap:12px')}>
              <Avatar initials={initials(detail.name)} size={52} />
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:18px;font-weight:700;color:var(--d-ink)')}>{detail.name}</div>
                <div className="d-num" style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{h(detail.worked)} worked · {detail.lines.length} visit{detail.lines.length === 1 ? '' : 's'}</div>
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
                      {(l.flags ?? []).length > 0 && <div style={s('display:flex;gap:5px;margin-top:5px;flex-wrap:wrap')}>{l.flags.map((f) => <Tag key={f} tone="warning">{f.replace(/_/g, ' ')}</Tag>)}</div>}
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
