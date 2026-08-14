import { useCallback, useEffect, useMemo, useState } from 'react';
import { getExceptions, correctClock, resolveAlert, getSettings, listAudit } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Panel, PanelTitle, StatCard, Avatar, Button, TableWrap, Th, Td, Row, SeverityPill, SegTabs } from '../ds/console.jsx';
import { LIFECYCLE_TONE, formatTime, formatDate, fullName } from '../api/format.js';

const SEV = { danger: 'high', warn: 'medium', neutral: 'low', info: 'low', active: 'low', success: 'low' };
const initsName = (name) => (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const initsPerson = (p) => ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')) || '?';
const ACTION_LABEL = { 'clock.corrected': 'Amended clock', 'timesheet.approved': 'Approved period', 'assignment.created': 'Assigned carer', 'request.approved': 'Approved request', 'request.declined': 'Declined request', 'cover.accepted': 'Cover filled' };

const TYPE = {
  missed_visit: { label: 'Missed visit', discrepancy: 'No clock-in was recorded for this visit' },
  no_clock_out: { label: 'No clock-out', discrepancy: 'Carer clocked in but never clocked out' },
  geo_anomaly: { label: 'Away from address', discrepancy: 'Clock point landed outside the registered fence' },
  visit_late: { label: 'Late arrival', discrepancy: 'Carer arrived after the grace period' },
  pending_review: { label: 'Needs review', discrepancy: 'Flagged for a manager decision' },
};
const typeLabel = (t) => TYPE[t]?.label ?? (t ?? '').replace(/_/g, ' ');

function isToday(iso) { return iso && new Date(iso).toDateString() === new Date().toDateString(); }

/* -------- amend / resolve drawer -------- */
function ExceptionDrawer({ ex, onClose, onDone }) {
  const toast = useToast();
  const { canManage } = useAuth();
  const [inTime, setInTime] = useState(ex.actualIn ? formatTime(ex.actualIn) : '');
  const [outTime, setOutTime] = useState(ex.actualOut ? formatTime(ex.actualOut) : '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canAmend = Boolean(ex.vaId);
  const meta = TYPE[ex.type] ?? {};

  const mk = (t) => { const base = new Date(ex.scheduledStart ?? Date.now()); const [h, m] = t.split(':').map(Number); base.setHours(h, m, 0, 0); return base.toISOString(); };

  async function save() {
    if (!reason.trim()) { toast.error('A reason is required — it goes in the audit trail'); return; }
    const jobs = [];
    if (inTime && inTime !== (ex.actualIn ? formatTime(ex.actualIn) : '')) jobs.push(correctClock({ visit_assignment_id: ex.vaId, kind: 'clock_in', occurred_at: mk(inTime), reason: reason.trim() }));
    if (outTime && outTime !== (ex.actualOut ? formatTime(ex.actualOut) : '')) jobs.push(correctClock({ visit_assignment_id: ex.vaId, kind: 'clock_out', occurred_at: mk(outTime), reason: reason.trim() }));
    if (jobs.length === 0) { toast.info('Change a clock time to amend, or use Accept as is'); return; }
    setBusy(true);
    try { await Promise.all(jobs); toast.success('Correction recorded against the original'); onDone(); onClose(); }
    catch (e) { toast.error(e.message || 'Could not record the correction'); } finally { setBusy(false); }
  }
  async function accept() {
    if (!ex.alertId) { onClose(); return; }
    setBusy(true);
    try { await resolveAlert(ex.alertId, reason.trim() || 'Accepted as is from the exceptions queue'); toast.success('Exception resolved'); onDone(); onClose(); }
    catch (e) { toast.error(e.message || 'Could not resolve'); } finally { setBusy(false); }
  }

  const upper = s('font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.06em');
  const field = { ...s('height:42px;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };

  return (
    <div onClick={onClose} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:480px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
        <div style={s('padding:20px 24px 15px;border-bottom:1px solid var(--d-border);display:flex;align-items:flex-start;gap:12px')}>
          <div style={s('flex:1;min-width:0')}>
            <div style={s('font-size:18px;font-weight:700;color:var(--d-ink)')}>{typeLabel(ex.type)} · {ex.carerName ?? 'Unassigned'}</div>
            <div style={s('display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:7px')}><SeverityPill severity={ex.severity} /><span style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{[ex.client, ex.address].filter(Boolean).join(' · ')}</span></div>
          </div>
          <div onClick={onClose} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2);flex:none'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
        </div>

        <div style={s('flex:1;overflow-y:auto;padding:18px 24px;display:flex;flex-direction:column;gap:18px')}>
          <div style={s('background:var(--d-warn-bg);color:var(--d-warn-ink);border-radius:12px;padding:12px 15px;font-size:12.5px;font-weight:600')}>{ex.discrepancy || meta.discrepancy}</div>

          <div>
            <div style={s('font-size:13px;font-weight:700;color:var(--d-ink);margin-bottom:8px')}>Carer explanation</div>
            <div style={s('border:1px solid var(--d-border);border-radius:12px;padding:11px 14px;font-size:12.5px;font-weight:500;color:var(--d-muted);font-style:italic')}>No reason submitted. The carer was prompted in-app when the flag was raised.</div>
          </div>

          {canAmend && canManage ? (
            <div>
              <div style={s('font-size:13px;font-weight:700;color:var(--d-ink);margin-bottom:10px')}>Amend the clocking record</div>
              <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
                <label style={s('display:flex;flex-direction:column;gap:6px')}>
                  <span style={upper}>Clock in</span>
                  <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} style={field} />
                  <span className="d-num" style={s('font-size:10.5px;font-weight:500;color:var(--d-muted)')}>Original {ex.actualIn ? formatTime(ex.actualIn) : 'none'}</span>
                </label>
                <label style={s('display:flex;flex-direction:column;gap:6px')}>
                  <span style={upper}>Clock out</span>
                  <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} style={field} />
                  <span className="d-num" style={s('font-size:10.5px;font-weight:500;color:var(--d-muted)')}>Original {ex.actualOut ? formatTime(ex.actualOut) : 'none'}</span>
                </label>
              </div>
              <label style={s('display:flex;flex-direction:column;gap:6px;margin-top:12px')}>
                <span style={upper}>Reason for amendment (required)</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Carer confirmed by phone they left at 19:05; battery died." style={{ ...field, height: 'auto', padding: '10px 13px', resize: 'vertical', lineHeight: 1.5 }} />
              </label>
            </div>
          ) : !canManage ? (
            <div style={s('border:1px solid var(--d-border);border-radius:12px;padding:12px 15px;font-size:12.5px;font-weight:500;color:var(--d-muted);line-height:1.55')}>Your role can review exceptions but not amend or resolve them. A manager or coordinator will action this.</div>
          ) : (
            <label style={s('display:flex;flex-direction:column;gap:6px')}>
              <span style={upper}>Resolution note (optional)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Note how this was resolved." style={{ ...field, height: 'auto', padding: '10px 13px', resize: 'vertical', lineHeight: 1.5 }} />
            </label>
          )}

          {ex.type === 'geo_anomaly' && (
            <div style={s('display:flex;align-items:center;gap:9px;background:var(--d-danger-bg);color:var(--d-danger-ink);border-radius:12px;padding:11px 14px;font-size:12px;font-weight:600')}>
              <Icon name="pin" size={15} />Clock point landed outside the registered fence{ex.address ? ` for ${ex.address}` : ''}.
            </div>
          )}

          <div style={s('border:1px solid var(--d-border);border-radius:12px;padding:12px 15px')}>
            <div style={s('font-size:12px;font-weight:700;color:var(--d-ink)')}>Audit note</div>
            <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);line-height:1.55;margin-top:4px')}>Saving writes a new, immutable audit entry under your name with the original values, the new values and your reason. Nothing is overwritten or deleted.</div>
          </div>

          <div style={{ ...s('border-radius:12px;padding:11px 14px;font-size:11.5px;font-weight:500'), background: ex.source === 'alert' ? 'var(--d-danger-bg)' : 'var(--d-panel)', color: ex.source === 'alert' ? 'var(--d-danger-ink)' : 'var(--d-muted)' }}>
            {ex.source === 'alert' ? `Raised automatically ${formatDate(ex.raised)} at ${formatTime(ex.raised)} — open until resolved.` : 'Flagged for review; no automatic escalation triggered.'}
          </div>
        </div>

        <div style={s('padding:16px 24px;border-top:1px solid var(--d-border);display:flex;flex-wrap:wrap;gap:10px')}>
          {canAmend && canManage && <Button variant="primary" icon="check" disabled={busy || !reason.trim()} onClick={save}>{busy ? 'Saving…' : 'Save & verify'}</Button>}
          {ex.alertId && canManage && <Button icon="check" onClick={accept}>Accept as is</Button>}
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function ExceptionsPage() {
  const [data, setData] = useState(null);
  const [resolved, setResolved] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [checked, setChecked] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const [ex, audit, st] = await Promise.all([getExceptions(), listAudit({ limit: 30 }).catch(() => []), getSettings().catch(() => null)]);
    setData(ex); setResolved(audit ?? []); setSettings(st);
  }, []);
  useEffect(() => { let a = true; load().finally(() => a && setLoading(false)); return () => { a = false; }; }, [load]);

  const exceptions = useMemo(() => {
    const pending = data?.pending_review ?? [];
    const alerts = data?.open_alerts ?? [];
    const rev = pending.map((va) => ({
      key: `r${va.id}`, source: 'review', vaId: va.id, alertId: null, type: 'pending_review',
      carerName: va.employee ? fullName(va.employee) : null, carerInits: va.employee ? initsPerson(va.employee) : '?',
      client: fullName(va.visit?.service_user), address: va.visit?.service_user?.address_line1,
      raised: va.visit?.scheduled_start, scheduledStart: va.visit?.scheduled_start,
      actualIn: va.actual_start, actualOut: va.actual_end,
      severity: SEV[LIFECYCLE_TONE[va.lifecycle_state]] ?? 'low',
      discrepancy: (va.flags ?? []).map((f) => f.replace(/_/g, ' ')).join(', ') || (va.actual_start && !va.actual_end ? 'Clocked in, no clock-out' : 'Flagged for review'),
    }));
    const al = alerts.map((a) => ({
      key: `a${a.id}`, source: 'alert', vaId: a.subject_type === 'VisitAssignment' ? a.subject_id : null, alertId: a.id, type: a.alert_type,
      carerName: a.carer, carerInits: initsName(a.carer),
      client: a.client, address: null, raised: a.raised_at, scheduledStart: null, actualIn: null, actualOut: null,
      severity: a.severity === 'high' ? 'high' : a.severity === 'medium' ? 'medium' : 'low',
      discrepancy: TYPE[a.alert_type]?.discrepancy ?? (a.alert_type ?? '').replace(/_/g, ' '),
    }));
    return [...al, ...rev];
  }, [data]);

  if (loading) return <Spinner fullscreen />;

  const types = [...new Set(exceptions.map((e) => e.type))];
  const rows = filter === 'all' ? exceptions : exceptions.filter((e) => e.type === filter);
  const tabs = [{ key: 'all', label: 'All open', count: exceptions.length }, ...types.map((t) => ({ key: t, label: typeLabel(t), count: exceptions.filter((e) => e.type === t).length }))];
  const highCount = exceptions.filter((e) => e.severity === 'high').length;
  const resolvedTodayCount = resolved.filter((ev) => isToday(ev.occurred_at)).length;
  const toggle = (k) => setChecked((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Stat cards */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        <StatCard label="Open exceptions" value={exceptions.length} hint="Awaiting a manager decision" tone="danger" icon="alert" live />
        <StatCard label="High severity" value={highCount} hint="Client welfare at risk" tone="warning" icon="shield" />
        <StatCard label="Awaiting review" value={(data?.pending_review ?? []).length} hint="Visits sitting for a decision" tone="magenta" icon="note" />
        <StatCard label="Resolved today" value={resolvedTodayCount} hint="Cleared from the audit trail" tone="success" icon="check" />
      </div>

      <div style={{ ...s('display:grid;gap:16px;align-items:start'), gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
        {/* Queue */}
        <div style={s('display:flex;flex-direction:column;gap:12px;min-width:0')}>
          <SegTabs tabs={tabs} active={filter} onSelect={setFilter} />
          <div style={s('background:var(--d-card);border-radius:18px;padding:12px 14px;overflow:auto')}>
            {rows.length === 0 ? (
              <div style={s('display:flex;flex-direction:column;align-items:center;gap:10px;padding:46px 20px')}>
                <div style={s('width:52px;height:52px;border-radius:16px;background:var(--d-ok-bg);display:flex;align-items:center;justify-content:center;color:var(--d-ok-ink)')}><Icon name="check" size={24} /></div>
                <div style={s('font-size:14px;font-weight:700;color:var(--d-ink2)')}>Nothing to resolve here</div>
                <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>New exceptions appear the moment an automation flags one.</div>
              </div>
            ) : (
              <TableWrap minWidth={860}>
                <thead><tr>
                  <Th>{' '}</Th><Th>Carer</Th><Th>Exception</Th><Th>Client</Th><Th>Raised</Th><Th>Carer reason</Th><Th>Tier</Th><Th align="right">Severity</Th>
                </tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <Row key={e.key} onClick={() => setSelected(e)} selected={selected?.key === e.key}>
                      <Td><input type="checkbox" checked={checked.includes(e.key)} onClick={(ev) => ev.stopPropagation()} onChange={() => toggle(e.key)} style={{ width: 15, height: 15, accentColor: 'var(--d-primary)' }} /></Td>
                      <Td>{e.carerName ? <span style={s('display:inline-flex;align-items:center;gap:9px')}><Avatar initials={e.carerInits} size="sm" /><b style={s('font-weight:700;color:var(--d-ink)')}>{e.carerName}</b></span> : <span style={s('color:var(--d-faint)')}>Unassigned</span>}</Td>
                      <Td>
                        <b style={s('font-weight:700;color:var(--d-ink);display:block')}>{typeLabel(e.type)}</b>
                        <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{e.discrepancy}</span>
                      </Td>
                      <Td>{e.client}</Td>
                      <Td mono>{e.raised ? formatTime(e.raised) : '—'}</Td>
                      <Td><span style={s('font-size:12px;font-weight:500;color:var(--d-muted);font-style:italic')}>No reason given</span></Td>
                      <Td><span style={s('color:var(--d-muted)')}>—</span></Td>
                      <Td align="right"><SeverityPill severity={e.severity} /></Td>
                    </Row>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
        </div>

        {/* Aside */}
        <div style={s('display:flex;flex-direction:column;gap:16px')}>
          <Panel>
            <PanelTitle hint="Cleared recently — from the audit trail">Recently resolved</PanelTitle>
            {resolved.length === 0 ? (
              <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Nothing resolved yet.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:9px')}>
                {resolved.slice(0, 5).map((ev) => (
                  <div key={ev.id} style={s('background:var(--d-panel);border-radius:12px;padding:11px 13px')}>
                    <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{ACTION_LABEL[ev.event_type] ?? (ev.event_type ?? '').replace(/[._]/g, ' ')}</div>
                    <div className="d-num" style={s('font-size:11px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{ev.actor_name ?? 'System'} · {formatTime(ev.occurred_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle hint="What happens automatically, from your settings">Automatic escalation</PanelTitle>
            <ol style={s('display:flex;flex-direction:column;gap:11px;margin:0;padding:0;list-style:none')}>
              {[
                ['Grace period', `${settings?.late_grace_minutes ?? '—'} min after the scheduled start`],
                ['Marked late', 'Once the grace period passes, the office is alerted'],
                ['Missed visit', `Flagged ${settings?.missed_threshold_minutes ?? '—'} min after the start`],
                ['Overdue', `Escalated ${settings?.overdue_threshold_minutes ?? '—'} min after the start`],
              ].map(([title, sub], i) => (
                <li key={title} style={s('display:flex;gap:11px')}>
                  <span className="d-num" style={s('width:24px;height:24px;border-radius:8px;background:var(--d-primary-soft);color:var(--d-primary-deep);display:flex;align-items:center;justify-content:center;flex:none;font-size:11px;font-weight:700')}>{i + 1}</span>
                  <span>
                    <span style={s('display:block;font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{title}</span>
                    <span style={s('display:block;font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{sub}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      {selected && <ExceptionDrawer ex={selected} onClose={() => setSelected(null)} onDone={load} />}
    </div>
  );
}
