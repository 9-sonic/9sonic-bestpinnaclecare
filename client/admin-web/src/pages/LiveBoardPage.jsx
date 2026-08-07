import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiveBoard, listAlerts, getCover } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Tabs, { panelRadius } from '../ds/Tabs.jsx';
import { StatCard, Panel, PanelTitle, Tag, Avatar, Button, TableWrap, Th, Td, Row } from '../ds/console.jsx';
import {
  LIFECYCLE_LABELS, LIFECYCLE_TONE, ATTENTION_ORDER,
  formatTime, formatTimeRange, fullName, minutesToHours,
} from '../api/format.js';

const REFRESH_MS = 60000;
const L2TAG = { neutral: 'muted', info: 'info', warn: 'warning', active: 'info', danger: 'danger', success: 'success' };
const StatusPill = ({ state }) => <Tag tone={L2TAG[LIFECYCLE_TONE[state]] ?? 'muted'}>{LIFECYCLE_LABELS[state] ?? state}</Tag>;
const inits = (p) => (p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '');
const ALERT_LABEL = { missed_visit: 'Visit missed', no_clock_out: 'No clock out', geo_anomaly: 'Clocked away from address', visit_late: 'Carer late', unassigned_visit: 'No carer', clock_in_failed: 'Could not clock in' };

// Which states count as "arriving" (not yet delivering / drifting).
const ARRIVAL_META = { scheduled: { label: 'Upcoming', tone: 'muted' }, check_in_window: { label: 'Due now', tone: 'info' }, grace_period: { label: 'In grace', tone: 'warning' }, late: { label: 'Late', tone: 'danger' } };
function inLabel(iso) {
  const mins = Math.round((new Date(iso) - Date.now()) / 60000);
  if (mins < -1) return `${-mins} min late`;
  if (mins <= 1) return 'due now';
  if (mins < 60) return `in ${mins} min`;
  return `in ${Math.round(mins / 60)}h`;
}

export default function LiveBoardPage() {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [board, setBoard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cover, setCover] = useState({ open_shifts: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    const [b, al, cv] = await Promise.all([
      getLiveBoard(),
      listAlerts().catch(() => []),
      getCover().catch(() => ({ open_shifts: [], counts: {} })),
    ]);
    setBoard(b); setAlerts(al ?? []); setCover(cv ?? { open_shifts: [], counts: {} });
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, [load]);

  if (loading) return <Spinner fullscreen />;

  const all = board?.assignments ?? [];
  const counts = board?.counts ?? {};
  const attention = all.filter((a) => ATTENTION_ORDER.includes(a.lifecycle_state));
  const match = (a) => {
    if (filter === 'active') return a.lifecycle_state === 'in_progress';
    if (filter === 'late') return a.lifecycle_state === 'late';
    if (filter === 'missed') return ['missed', 'overdue'].includes(a.lifecycle_state);
    if (filter === 'done') return a.lifecycle_state === 'completed';
    return true;
  };
  const rows = all.filter(match);
  const tabDefs = [
    { key: 'all', label: 'All shifts', icon: 'calendar', count: all.length },
    { key: 'active', label: 'On shift', icon: 'target', count: counts.in_progress ?? 0 },
    { key: 'late', label: 'Late', icon: 'clock', count: counts.late ?? 0 },
    { key: 'missed', label: 'Missed', icon: 'alert', count: (counts.missed ?? 0) + (counts.overdue ?? 0), alert: (counts.missed ?? 0) > 0 },
    { key: 'done', label: 'Completed', icon: 'check', count: counts.completed ?? 0 },
  ];

  // Derived-from-real sections
  const arrivals = all
    .filter((a) => ARRIVAL_META[a.lifecycle_state])
    .sort((x, y) => new Date(x.visit?.scheduled_start) - new Date(y.visit?.scheduled_start))
    .slice(0, 6);
  const openAlerts = alerts.filter((a) => a.state === 'open').slice(0, 4);
  const escalation = [...alerts].sort((x, y) => new Date(y.raised_at) - new Date(x.raised_at)).slice(0, 5);
  const coverage = (cover.open_shifts ?? []).slice(0, 4);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const handover = [
    ['Visits completed', counts.completed ?? 0],
    ['On shift now', counts.in_progress ?? 0],
    ['Exceptions outstanding', attention.length],
    ['Unfilled visits', cover.counts?.open ?? 0],
  ];

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Greeting */}
      <div>
        <div style={s('font-size:26px;font-weight:600;color:var(--d-ink);letter-spacing:-0.5px')}>
          {greeting}{admin?.first_name ? `, ${admin.first_name}` : ''}
        </div>
        <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);margin-top:3px')}>Here&rsquo;s what needs you across Best Pinnacle Care right now.</div>
      </div>

      {/* Live status bar */}
      <div style={s('display:flex;align-items:center;gap:10px;background:var(--d-card);border-radius:16px;padding:11px 16px;flex-wrap:wrap')}>
        <span style={s('width:8px;height:8px;border-radius:50%;background:var(--d-ok-ink)')} />
        <span style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>Live</span>
        <span className="d-num" style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        <span style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>· {all.length} shifts scheduled today</span>
        <div style={s('flex:1')} />
        {updatedAt && <span style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>Updated {updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
        <Button icon="refresh" size="sm" onClick={load}>Refresh</Button>
      </div>

      {/* Stat cards */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px')}>
        <StatCard label="On shift now" value={counts.in_progress ?? 0} hint="Clocked in, delivering care" tone="success" icon="target" live active={filter === 'active'} onClick={() => setFilter(filter === 'active' ? 'all' : 'active')} />
        <StatCard label="Late" value={counts.late ?? 0} hint="Past the grace period" tone="warning" icon="clock" active={filter === 'late'} onClick={() => setFilter(filter === 'late' ? 'all' : 'late')} />
        <StatCard label="Missed / overdue" value={(counts.missed ?? 0) + (counts.overdue ?? 0)} hint="Escalation running" tone="danger" icon="alert" active={filter === 'missed'} onClick={() => setFilter(filter === 'missed' ? 'all' : 'missed')} />
        <StatCard label="Awaiting review" value={counts.pending_review ?? 0} hint="Needs a decision" tone="magenta" icon="note" />
        <StatCard label="Completed" value={counts.completed ?? 0} hint="Finished today" tone="info" icon="check" active={filter === 'done'} onClick={() => setFilter(filter === 'done' ? 'all' : 'done')} />
      </div>

      <div style={s('display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start')}>
        <div style={s('display:flex;flex-direction:column;gap:16px;min-width:0')}>
          {/* Arrivals board — real, from board assignments */}
          <Panel>
            <PanelTitle hint="The next arrivals and anyone drifting past their start time">Arrivals board</PanelTitle>
            {arrivals.length === 0 ? (
              <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);padding:4px 2px')}>Nobody due to arrive right now.</div>
            ) : (
              <div style={s('display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px')}>
                {arrivals.map((a) => {
                  const m = ARRIVAL_META[a.lifecycle_state];
                  return (
                    <div key={a.id} onClick={() => setDetail(a)} className="hv" style={{ ...s('display:flex;align-items:center;gap:11px;border:1px solid var(--d-border);border-radius:14px;padding:11px 13px;cursor:pointer'), '--hbg': 'var(--d-panel)' }}>
                      <Avatar initials={inits(a.employee) || '—'} size="sm" />
                      <div style={s('flex:1;min-width:0')}>
                        <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{a.employee ? fullName(a.employee) : 'Unassigned'} → {fullName(a.visit?.service_user)}</div>
                        <div className="d-num" style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>{formatTimeRange(a.visit?.scheduled_start, a.visit?.scheduled_end)}</div>
                      </div>
                      <Tag tone={m.tone}>{inLabel(a.visit?.scheduled_start)}</Tag>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Roster */}
          <div style={s('display:flex;flex-direction:column')}>
            <Tabs tabs={tabDefs} active={filter} onSelect={setFilter} />
            <div style={{ ...s('background:var(--d-panel);padding:14px'), borderRadius: panelRadius(tabDefs, filter) }}>
              <div style={s('background:var(--d-card);border-radius:18px;padding:12px 14px;overflow:auto')}>
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
                          <Td><StatusPill state={a.lifecycle_state} /></Td>
                        </Row>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Aside */}
        <div style={s('display:flex;flex-direction:column;gap:16px')}>
          <Panel>
            <PanelTitle hint="System-raised, still open — attend so records stay right">Open alerts</PanelTitle>
            {openAlerts.length === 0 ? (
              <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);padding:2px')}>No open alerts.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:9px')}>
                {openAlerts.map((c) => (
                  <div key={c.id} style={s('border:1px solid var(--d-border);border-radius:14px;padding:12px 13px')}>
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
            <Button size="sm" onClick={() => setFilter('all')} icon="chevronRight">Alert inbox</Button>
          </Panel>

          <Panel>
            <PanelTitle hint="Highest priority right now">Needs attention now</PanelTitle>
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
            <PanelTitle hint="Alerts raised — the escalation record">Escalation feed</PanelTitle>
            {escalation.length === 0 ? (
              <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);padding:2px')}>No escalations today.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:11px')}>
                {escalation.map((e) => {
                  const tier = e.severity === 'high' ? 3 : e.severity === 'medium' ? 2 : 1;
                  return (
                    <div key={e.id} style={s('display:flex;gap:10px')}>
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

      {/* Daily handover — real counts */}
      <Panel>
        <PanelTitle hint="End-of-day summary from today's real activity">Daily handover</PanelTitle>
        <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px')}>
          {handover.map(([l, v]) => (
            <div key={l} style={s('background:var(--d-panel);border-radius:14px;padding:13px 15px')}>
              <div style={s('font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{l}</div>
              <div className="d-num" style={s('font-size:22px;font-weight:700;color:var(--d-ink);margin-top:3px')}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Detail drawer */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:460px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 16px;border-bottom:1px solid var(--d-border);display:flex;align-items:flex-start;gap:12px')}>
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:18px;font-weight:700;color:var(--d-ink)')}>{fullName(detail.visit?.service_user)}</div>
                <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{detail.employee ? fullName(detail.employee) : 'Unassigned'} · {detail.visit?.service_user?.address_line1}</div>
                <div style={s('margin-top:8px')}><StatusPill state={detail.lifecycle_state} /></div>
              </div>
              <div onClick={() => setDetail(null)} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:16px')}>
              <div style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:10px')}>
                {[['Scheduled', formatTimeRange(detail.visit?.scheduled_start, detail.visit?.scheduled_end)], ['Actual', `${detail.actual_start ? formatTime(detail.actual_start) : '—'}–${detail.actual_end ? formatTime(detail.actual_end) : 'open'}`], ['Worked', detail.worked_minutes != null ? minutesToHours(detail.worked_minutes) : '—']].map(([l, v]) => (
                  <div key={l} style={s('background:var(--d-panel);border-radius:14px;padding:12px;text-align:center')}>
                    <div style={s('font-size:10px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{l}</div>
                    <div className="d-num" style={s('font-size:14px;font-weight:700;color:var(--d-ink);margin-top:4px')}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={s('background:var(--d-note-bg);border-radius:14px;padding:13px 15px;font-size:11.5px;font-weight:500;color:var(--d-note-ink);line-height:1.55')}>Any amendment is appended to the audit trail with your name, the time and a mandatory reason. The original record is never overwritten.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
