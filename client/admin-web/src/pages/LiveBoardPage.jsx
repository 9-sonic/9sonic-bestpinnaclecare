import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiveBoard, listAlerts, getCover, getDashboard } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import Modal from '../components/common/Modal.jsx';
import { s } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { StatCard, Panel, PanelTitle, Tag, Avatar, Button, TableWrap, Th, Td, Row, SegTabs } from '../ds/console.jsx';
import {
  LIFECYCLE_LABELS, LIFECYCLE_TONE, ATTENTION_ORDER,
  formatTime, formatTimeRange, fullName, minutesToHours,
} from '../api/format.js';

const REFRESH_MS = 60000;
const L2TAG = { neutral: 'muted', info: 'info', warn: 'warning', active: 'info', danger: 'danger', success: 'success' };
const StatusPill = ({ state }) => <Tag tone={L2TAG[LIFECYCLE_TONE[state]] ?? 'muted'}>{LIFECYCLE_LABELS[state] ?? state}</Tag>;
const inits = (p) => (p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '');
const ALERT_LABEL = { missed_visit: 'Visit missed', no_clock_out: 'No clock out', geo_anomaly: 'Clocked away from address', visit_late: 'Carer late', unassigned_visit: 'No carer', clock_in_failed: 'Could not clock in' };

function inLabel(iso) {
  const mins = Math.round((new Date(iso) - Date.now()) / 60000);
  if (mins < -1) return `${-mins} min late`;
  if (mins <= 1) return 'due now';
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.round(mins / 60)}h`;
}

// Nth weekday of a month (e.g. last Monday of May) — for UK bank holidays that
// fall on a weekday rather than a fixed date.
function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + (n - 1) * 7).getDate();
  }
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return last.getDate() - offset;
}

// A greeting that leans into the day: named UK holidays and seasonal moments
// take priority; otherwise a warm time-of-day greeting. Returns the FULL line
// (name folded in where it reads naturally) so callers render it verbatim.
function greetingFor(now, name) {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const d = now.getDate();
  const who = name ? `, ${name}` : '';
  const is = (mm, dd) => m === mm && d === dd;

  // Fixed-date holidays / seasonal days.
  if (is(0, 1)) return `Happy New Year${who} 🎉`;
  if (m === 1 && d === 14) return `Happy Valentine's Day${who}`;
  if (m === 2 && d === 17) return `Happy St Patrick's Day${who} ☘️`;
  if (is(9, 31)) return `Happy Halloween${who} 🎃`;
  if (m === 11 && d >= 24 && d <= 26) return `Merry Christmas${who} 🎄`;
  if (m === 11 && d >= 27 && d <= 31) return `Season's greetings${who} ✨`;
  // UK bank holidays that move: early May (1st Mon), spring (last Mon May),
  // summer (last Mon Aug).
  if (m === 4 && d === nthWeekday(y, 4, 1, 1)) return `Happy bank holiday${who}`;
  if (m === 4 && d === nthWeekday(y, 4, 1, 0)) return `Happy bank holiday${who}`;
  if (m === 7 && d === nthWeekday(y, 7, 1, 0)) return `Happy bank holiday${who}`;

  // Seasonal warmth on the solstice-ish weeks, else time of day.
  const hour = now.getHours();
  const base = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${base}${who}`;
}

export default function LiveBoardPage() {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const toast = useToast();
  const [board, setBoard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cover, setCover] = useState({ open_shifts: [], counts: {} });
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  // Fetch the board. The live_board call is the one that must succeed — alerts
  // and cover degrade gracefully — so a failure here is surfaced, not swallowed.
  const load = useCallback(async () => {
    const [b, al, cv, ds] = await Promise.all([
      getLiveBoard(),
      listAlerts().catch(() => []),
      getCover().catch(() => ({ open_shifts: [], counts: {} })),
      getDashboard().catch(() => null),
    ]);
    setBoard(b); setAlerts(al ?? []); setCover(cv ?? { open_shifts: [], counts: {} }); setDash(ds);
  }, []);

  // Manual refresh: give feedback (button shows "Refreshing…" + disables) and
  // never fail silently — a rejected fetch now raises a toast instead of a
  // no-op click.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      toast.error(e.message || 'Could not refresh the live board');
    } finally {
      setRefreshing(false);
    }
  }, [load, toast]);

  useEffect(() => {
    let active = true;
    load().catch(() => {}).finally(() => active && setLoading(false));
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load().catch(() => {});
    }, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, [load]);

  if (loading) return <Spinner fullscreen />;

  const all = board?.assignments ?? [];
  const counts = board?.counts ?? {};
  const attention = all.filter((a) => ATTENTION_ORDER.includes(a.lifecycle_state));
  const SCHEDULED_STATES = ['scheduled', 'check_in_window', 'grace_period'];
  const match = (a) => {
    if (filter === 'scheduled') return SCHEDULED_STATES.includes(a.lifecycle_state);
    if (filter === 'active') return a.lifecycle_state === 'in_progress';
    if (filter === 'late') return a.lifecycle_state === 'late';
    if (filter === 'missed') return ['missed', 'overdue'].includes(a.lifecycle_state);
    if (filter === 'done') return a.lifecycle_state === 'completed';
    return true;
  };
  const rows = all.filter(match);
  const scheduledCount = all.filter((a) => SCHEDULED_STATES.includes(a.lifecycle_state)).length;
  const tabDefs = [
    { key: 'all', label: 'All shifts', icon: 'calendar', count: all.length },
    { key: 'scheduled', label: 'Scheduled', icon: 'calendar', count: scheduledCount },
    { key: 'active', label: 'On shift', icon: 'target', count: counts.in_progress ?? 0 },
    { key: 'late', label: 'Late', icon: 'clock', count: counts.late ?? 0 },
    { key: 'missed', label: 'Missed', icon: 'alert', count: (counts.missed ?? 0) + (counts.overdue ?? 0), alert: (counts.missed ?? 0) > 0 },
    { key: 'done', label: 'Completed', icon: 'check', count: counts.completed ?? 0 },
  ];

  // Derived-from-real sections
  const openAlerts = alerts.filter((a) => a.state === 'open').slice(0, 4);
  const escalation = [...alerts].sort((x, y) => new Date(y.raised_at) - new Date(x.raised_at)).slice(0, 5);
  const coverage = (cover.open_shifts ?? []).slice(0, 4);
  const now = new Date();
  const greeting = greetingFor(now, admin?.first_name);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Hero header — greeting on the left, live clock + refresh on the right,
          in one composed row instead of a heading stacked over a thin strip. */}
      <div style={s('display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap')}>
        <div style={s('flex:1;min-width:240px')}>
          <div style={s('font-size:26px;font-weight:700;color:var(--d-ink);letter-spacing:-0.5px')}>
            {greeting}
          </div>
          <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);margin-top:3px')}>Here&rsquo;s what needs your attention right now.</div>
        </div>
        <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
          <div style={s('display:flex;align-items:center;gap:9px;background:var(--d-card);border:1px solid var(--d-card-line,transparent);box-shadow:var(--d-shadow-card,none);border-radius:14px;padding:9px 15px')}>
            <span style={{ ...s('width:8px;height:8px;border-radius:50%;flex:none'), background: 'var(--d-ok-ink)' }} />
            <span style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>Live</span>
            <span style={s('font-size:12.5px;font-weight:500;color:var(--d-faint)')}>· {all.length} today</span>
          </div>
          <span data-tour="liveboard-refresh" style={s('display:inline-flex;align-items:center;gap:9px')}>
            <Button icon="refresh" size="sm" disabled={refreshing} onClick={refresh}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>
          </span>
        </div>
      </div>

      {/* Stat cards — capped so they sit in a tidy row instead of stretching wide */}
      <div data-tour="liveboard-stats" style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px')}>
        <StatCard label="On shift now" value={counts.in_progress ?? 0} hint="Clocked in, delivering care" tone="success" icon="target" live active={filter === 'active'} onClick={() => setFilter(filter === 'active' ? 'all' : 'active')} />
        <StatCard label="Late" value={counts.late ?? 0} hint="Past the grace period" tone="warning" icon="clock" active={filter === 'late'} onClick={() => setFilter(filter === 'late' ? 'all' : 'late')} />
        <StatCard label="Missed / overdue" value={(counts.missed ?? 0) + (counts.overdue ?? 0)} hint="Escalation running" tone="danger" icon="alert" active={filter === 'missed'} onClick={() => setFilter(filter === 'missed' ? 'all' : 'missed')} />
        <StatCard label="Completed" value={counts.completed ?? 0} hint="Finished today" tone="info" icon="check" active={filter === 'done'} onClick={() => setFilter(filter === 'done' ? 'all' : 'done')} />
        {/* Backlog that outlives "today": auto-closed visits awaiting a manager's
            review, and upcoming visits with no carer. Global counts from the
            dashboard endpoint — the today-only board can't show these. */}
        {(dash?.pending_review ?? 0) > 0 && (
          <StatCard label="Needs review" value={dash.pending_review} hint="Auto-closed — awaiting a manager" tone="warning" icon="eye" onClick={() => navigate('/exceptions')} />
        )}
        {(dash?.unassigned_upcoming ?? 0) > 0 && (
          <StatCard label="Unassigned (7 days)" value={dash.unassigned_upcoming} hint="Upcoming visits with no carer" tone="danger" icon="users" onClick={() => navigate('/staffing')} />
        )}
      </div>

      <div style={s('display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start')}>
        <div style={s('display:flex;flex-direction:column;gap:16px;min-width:0')}>

          {/* Roster */}
          <div style={s('display:flex;flex-direction:column;gap:12px')}>
            <span data-tour="liveboard-tabs"><SegTabs tabs={tabDefs} active={filter} onSelect={setFilter} /></span>
            <div data-tour="liveboard-roster" style={s('background:var(--d-panel);border-radius:20px;padding:14px;min-height:320px')}>
              <div style={s('background:var(--d-card);border-radius:18px;padding:12px 14px;overflow:auto;height:100%;box-sizing:border-box')}>
                {rows.length === 0 ? (
                  <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>No shifts match this view.</div>
                ) : (
                  <TableWrap minWidth={820}>
                    <thead><tr><Th>Carer</Th><Th>Client &amp; address</Th><Th>Scheduled</Th><Th>Actual in / out</Th><Th>Worked</Th><Th>Status</Th></tr></thead>
                    <tbody>
                      {rows.map((a) => (
                        <Row key={a.id} onClick={() => setDetail(a)}>
                          <Td>{a.employee ? <span style={s('display:inline-flex;align-items:center;gap:9px')}><Avatar initials={inits(a.employee)} size="sm" /><b style={s('font-weight:700;color:var(--d-ink)')}>{fullName(a.employee)}</b></span> : <span style={s('color:var(--d-faint)')}>Unassigned</span>}</Td>
                          <Td>
                            <b style={s('font-weight:700;color:var(--d-ink);display:block')}>{fullName(a.visit?.service_user)}</b>
                            <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{a.visit?.service_user?.address_line1}</span>
                          </Td>
                          <Td mono>{formatTimeRange(a.visit?.scheduled_start, a.visit?.scheduled_end)}</Td>
                          <Td mono>{a.actual_start ? formatTime(a.actual_start) : '--:--'} – {a.actual_end ? formatTime(a.actual_end) : '--:--'}</Td>
                          <Td mono><b style={s('font-weight:700;color:var(--d-ink)')}>{a.worked_minutes != null ? minutesToHours(a.worked_minutes) : '–'}</b></Td>
                          <Td><span style={s('display:inline-flex;align-items:center;gap:6px')}><StatusPill state={a.lifecycle_state} />{(a.flags ?? []).length > 0 && <span title={a.flags.join(', ').replace(/_/g, ' ')} style={s('display:inline-flex;color:var(--d-warn-ink)')}><Icon name="alert" size={14} /></span>}</span></Td>
                        </Row>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Aside — a spacer pushes it down so it starts level with the roster,
            not the tabs. Roster top = tabs(32px) + roster gap(12px) = 44px; the
            aside's own 16px column gap covers part of it, so the spacer is 28px. */}
        <div style={s('display:flex;flex-direction:column;gap:16px')}>
          <div style={s('height:28px;flex:none')} aria-hidden="true" />
          <Panel>
            <PanelTitle hint="System-raised, still open — attend so records stay right"
              action={<Button size="sm" icon="chevronRight" onClick={() => navigate('/exceptions?tab=alerts')}>Alerts</Button>}>
              Open alerts
            </PanelTitle>
            {openAlerts.length === 0 ? (
              <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);padding:2px')}>No open alerts.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:9px')}>
                {openAlerts.map((c) => (
                  <div key={c.id} onClick={() => navigate('/exceptions?tab=alerts')} className="hv" style={{ ...s('border:1px solid var(--d-border);border-radius:14px;padding:12px 13px;cursor:pointer'), '--hbg': 'var(--d-panel)' }}>
                    <div style={s('display:flex;align-items:center;gap:9px')}>
                      <div style={{ ...s('width:8px;height:8px;border-radius:50%;flex:none'), background: c.severity === 'high' ? 'var(--d-danger-dot)' : 'var(--d-warn-dot)' }} />
                      <div style={s('flex:1;min-width:0;font-size:12.5px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{c.carer ? `${c.carer} → ${c.client}` : (ALERT_LABEL[c.alert_type] ?? c.alert_type)}</div>
                      {c.severity === 'high' && <Tag tone="danger">high</Tag>}
                    </div>
                    <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-top:4px')}>{ALERT_LABEL[c.alert_type] ?? c.alert_type} · {formatTime(c.raised_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle hint="Highest priority right now"
              action={<Button size="sm" icon="chevronRight" onClick={() => navigate('/exceptions')}>Exceptions</Button>}>
              Needs attention now
            </PanelTitle>
            {attention.length === 0 ? (
              <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);padding:2px')}>Nothing outstanding.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:8px')}>
                {attention.slice(0, 4).map((a) => (
                  <div key={a.id} onClick={() => setDetail(a)} className="hv" style={{ ...s('border:1px solid var(--d-border);border-radius:14px;padding:11px 13px;cursor:pointer'), '--hbg': 'var(--d-panel)' }}>
                    <div style={s('display:flex;align-items:center;gap:8px')}>
                      <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{fullName(a.visit?.service_user)}</div>
                      <StatusPill state={a.lifecycle_state} />
                    </div>
                    <div style={s('font-size:11px;font-weight:500;color:var(--d-muted);margin-top:3px')}>Scheduled {formatTime(a.visit?.scheduled_start)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle hint="Alerts raised — the escalation record"
              action={<Button size="sm" icon="chevronRight" onClick={() => navigate('/exceptions?tab=lifecycle')}>Escalation log</Button>}>
              Escalation feed
            </PanelTitle>
            {escalation.length === 0 ? (
              <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);padding:2px')}>No escalations today.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:11px')}>
                {escalation.map((e) => {
                  const tier = e.severity === 'high' ? 3 : e.severity === 'medium' ? 2 : 1;
                  return (
                    <div key={e.id} onClick={() => navigate('/exceptions?tab=lifecycle')} className="hv" style={{ ...s('display:flex;gap:10px;cursor:pointer;border-radius:10px;padding:4px;margin:-4px'), '--hbg': 'var(--d-panel)' }}>
                      <div className="d-num" style={{ ...s('width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none;font-size:11px;font-weight:700'), background: e.state === 'resolved' ? 'var(--d-ok-bg)' : 'var(--d-danger-bg)', color: e.state === 'resolved' ? 'var(--d-ok-ink)' : 'var(--d-danger-ink)' }}>T{tier}</div>
                      <div style={s('min-width:0')}>
                        <div style={s('font-size:12px;font-weight:700;color:var(--d-ink)')}>{e.carer ? `${e.carer} · ${e.client}` : (ALERT_LABEL[e.alert_type] ?? e.alert_type)}</div>
                        <div style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>{ALERT_LABEL[e.alert_type] ?? e.alert_type} — {e.state}</div>
                        <div className="d-num" style={s('font-size:10.5px;font-weight:500;color:var(--d-faint)')}>{formatTime(e.raised_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Coverage risk — real unfilled visits */}
      <Panel>
        <PanelTitle hint="Visits with no carer — fill them before they become missed calls"
          action={<Button size="sm" icon="chevronRight" onClick={() => navigate('/cover')}>Cover board</Button>}>
          Coverage risk
        </PanelTitle>
        {coverage.length === 0 ? (
          <div style={s('display:flex;align-items:center;gap:10px;padding:4px 2px')}>
            <div style={s('width:34px;height:34px;border-radius:11px;background:var(--d-ok-bg);display:flex;align-items:center;justify-content:center;color:var(--d-ok-ink)')}><Icon name="check" size={17} /></div>
            <div style={s('font-size:13px;font-weight:600;color:var(--d-ink2)')}>Every upcoming visit has a carer.</div>
          </div>
        ) : (
          <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px')}>
            {coverage.map((sh) => {
              const hrsUntil = (new Date(sh.visit.scheduled_start) - Date.now()) / 3600000;
              const tone = hrsUntil < 2 ? 'danger' : hrsUntil < 24 ? 'warning' : 'info';
              return (
                <div key={sh.visit.id} style={{ ...s('border-radius:14px;padding:13px 15px'), background: tone === 'danger' ? 'var(--d-danger-bg)' : tone === 'warning' ? 'var(--d-warn-bg)' : 'var(--d-panel)' }}>
                  <div style={{ ...s('font-size:13px;font-weight:700'), color: tone === 'danger' ? 'var(--d-danger-ink)' : tone === 'warning' ? 'var(--d-warn-ink)' : 'var(--d-ink)' }}>{sh.visit.client} · {formatTime(sh.visit.scheduled_start)} has no carer</div>
                  <div className="d-num" style={{ ...s('font-size:11px;font-weight:700;margin-top:5px'), color: tone === 'danger' ? 'var(--d-danger-ink)' : tone === 'warning' ? 'var(--d-warn-ink)' : 'var(--d-muted)' }}>{inLabel(sh.visit.scheduled_start)} · {sh.state === 'offered' ? 'offered, awaiting reply' : 'needs cover'}</div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>


      {/* Detail modal */}
      {detail && (
        <Modal
          onClose={() => setDetail(null)}
          maxWidth={460}
          title={fullName(detail.visit?.service_user)}
          subtitle={
            <span style={s('display:flex;flex-direction:column;gap:6px')}>
              <span style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{detail.employee ? fullName(detail.employee) : 'Unassigned'} · {detail.visit?.service_user?.address_line1}</span>
              <span><StatusPill state={detail.lifecycle_state} /></span>
            </span>
          }
          footer={ATTENTION_ORDER.includes(detail.lifecycle_state) ? (
            <div style={s('display:flex;justify-content:flex-end')}>
              <Button variant="primary" icon="chevronRight" onClick={() => navigate(`/exceptions?va=${detail.id}`)}>Review &amp; resolve</Button>
            </div>
          ) : null}
        >
            <div style={s('flex:1;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:16px')}>
              <div style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:10px')}>
                {[['Scheduled', formatTimeRange(detail.visit?.scheduled_start, detail.visit?.scheduled_end)], ['Actual', `${detail.actual_start ? formatTime(detail.actual_start) : '—'}–${detail.actual_end ? formatTime(detail.actual_end) : 'open'}`], ['Worked', detail.worked_minutes != null ? minutesToHours(detail.worked_minutes) : '—']].map(([l, v]) => (
                  <div key={l} style={s('background:var(--d-panel);border-radius:14px;padding:12px;text-align:center')}>
                    <div style={s('font-size:10px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{l}</div>
                    <div className="d-num" style={s('font-size:14px;font-weight:700;color:var(--d-ink);margin-top:4px')}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Anomaly flags raised on this assignment (e.g. auto_closed). */}
              {(detail.flags ?? []).length > 0 && (
                <div style={s('display:flex;align-items:center;gap:7px;flex-wrap:wrap')}>
                  <span style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Flags</span>
                  {detail.flags.map((f) => <Tag key={f} tone="warning">{f.replace(/_/g, ' ')}</Tag>)}
                </div>
              )}
              <div style={s('background:var(--d-note-bg);border-radius:14px;padding:13px 15px;font-size:11.5px;font-weight:500;color:var(--d-note-ink);line-height:1.55')}>Any amendment is appended to the audit trail with your name, the time and a mandatory reason. The original record is never overwritten.</div>
            </div>
        </Modal>
      )}
    </div>
  );
}
