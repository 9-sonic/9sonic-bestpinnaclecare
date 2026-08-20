import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { fullName, formatTime, formatTimeRange, formatDate, minutesToHours, addressOf } from '../api/format.js';
import { Panel, PanelTitle, Tag, Avatar, Button } from '../ds/console.jsx';
import { getVisit } from '../api/index.js';

// A single visit as a COMPLETE record: who attended (actual in/out), the clock
// history (in/out taps with location), tasks done, carer notes, and the care
// plan in force. This is the page every list (client visits, carer activity,
// the rota) drills into — the visit is the unit of truth, not the carer.

const LIFECYCLE_TONE = {
  completed: 'success', in_progress: 'info', scheduled: 'muted', check_in_window: 'info',
  grace_period: 'warning', late: 'warning', missed: 'danger', overdue: 'danger',
  pending_review: 'warning', cancelled: 'muted',
};
const CLOCK_KIND = { clock_in: 'Clocked in', clock_out: 'Clocked out', break_start: 'Break start', break_end: 'Break end' };
const ORIGIN_LABEL = { offline_sync: 'offline — synced later', manual_admin: 'entered by office' };

// The device a tap came from — platform + app version if we know the device,
// else the short fingerprint. An EVV trust signal.
function deviceLabel(d) {
  if (!d) return '';
  if (d.platform) return `${d.platform}${d.app_version ? ` ${d.app_version}` : ''}`;
  return `device ${String(d.fingerprint).slice(0, 8)}`;
}

const inits = (p) => ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')) || ((p?.full_name ?? p?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join(''));

export default function VisitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(undefined); // undefined = loading, null = failed

  useEffect(() => {
    let active = true;
    setVisit(undefined);
    getVisit(id).then((v) => active && setVisit(v)).catch(() => active && setVisit(null));
    return () => { active = false; };
  }, [id]);

  if (visit === undefined) return <Spinner fullscreen />;
  if (visit === null) return <div style={s('padding:40px;font-size:14px;color:var(--d-muted)')}>That visit could not be found. <Button size="sm" onClick={() => navigate(-1)}>Back</Button></div>;

  const su = visit.service_user;
  const assignments = visit.assignments ?? [];
  const carePlan = visit.care_plan ?? [];
  const state = visit.status === 'cancelled' ? 'cancelled' : (assignments[0]?.lifecycle_state ?? 'scheduled');
  const hdr = s('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--d-muted)');

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Header — the visit itself: client, when, state. (The top bar already
          provides Back, so no in-page back link.) */}
      <Panel style={{ padding: '22px 26px' }}>
        <div style={s('min-width:0')}>
          <div style={s('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
            <button type="button" onClick={() => navigate(su ? `/clients/${su.id}` : -1)} className="hv"
              style={{ ...s('font-size:23px;font-weight:700;letter-spacing:-0.4px;color:var(--d-ink);background:transparent;border:0;cursor:pointer;padding:0'), fontFamily: 'inherit' }}>
              {su ? fullName(su) : `Visit ${visit.id}`}
            </button>
            <Tag tone={LIFECYCLE_TONE[state] ?? 'muted'}>{state.replace(/_/g, ' ')}</Tag>
            {visit.status === 'draft' && <Tag tone="muted">Draft</Tag>}
          </div>
          <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;font-weight:500;color:var(--d-muted);margin-top:6px')}>
            <span style={s('display:inline-flex;align-items:center;gap:5px')}><Icon name="calendar" size={14} />{formatDate(visit.scheduled_start)}</span>
            <span style={s('opacity:0.5')}>·</span>
            <span style={s('display:inline-flex;align-items:center;gap:5px')}><Icon name="clock" size={14} />{formatTimeRange(visit.scheduled_start, visit.scheduled_end)}</span>
            {su && addressOf(su) && <><span style={s('opacity:0.5')}>·</span><span style={s('display:inline-flex;align-items:center;gap:5px')}><Icon name="pin" size={14} />{addressOf(su)}</span></>}
          </div>
        </div>
      </Panel>

      {/* Attendance — who was on this visit, actual in/out, worked. */}
      <Panel style={{ padding: '18px 20px' }}>
        <PanelTitle>Attendance</PanelTitle>
        {assignments.length === 0 ? (
          <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);padding:6px 2px')}>No carer was assigned to this visit.</div>
        ) : (
          <div style={s('display:flex;flex-direction:column;gap:8px')}>
            {assignments.map((a) => (
              <div key={a.id} style={s('display:flex;align-items:center;gap:12px;background:var(--d-panel);border-radius:12px;padding:12px 14px')}>
                <Avatar initials={inits(a.employee)} size="sm" />
                <div style={s('flex:1;min-width:0')}>
                  <button type="button" onClick={() => a.employee && navigate(`/employees/${a.employee.id}`)} className="hv"
                    style={{ ...s('font-size:13.5px;font-weight:700;color:var(--d-ink);background:transparent;border:0;cursor:pointer;padding:0;text-align:left'), fontFamily: 'inherit' }}>
                    {a.employee ? fullName(a.employee) : 'Unassigned'}
                  </button>
                  <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>
                    {a.actual_start ? formatTime(a.actual_start) : '—'}–{a.actual_end ? formatTime(a.actual_end) : (a.actual_start ? 'open' : '—')}
                    {a.worked_minutes != null ? ` · ${minutesToHours(a.worked_minutes)} worked` : ''}
                  </div>
                </div>
                {a.lifecycle_state && <Tag tone={LIFECYCLE_TONE[a.lifecycle_state] ?? 'muted'}>{a.lifecycle_state.replace(/_/g, ' ')}</Tag>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Clock history — the honest in/out record with location. */}
      <Panel style={{ padding: '18px 20px' }}>
        <PanelTitle>Clock history</PanelTitle>
        {(() => {
          const clock = assignments.flatMap((a) => (a.clock_events ?? []).map((c) => ({ ...c, carer: a.employee?.full_name })));
          if (clock.length === 0) return <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);padding:6px 2px')}>No clock events recorded for this visit.</div>;
          return (
            <div style={s('display:flex;flex-direction:column;gap:8px')}>
              {clock.map((c) => (
                <div key={c.id} style={s('display:flex;align-items:center;gap:11px;background:var(--d-panel);border-radius:12px;padding:11px 14px')}>
                  <div style={{ ...s('width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none'), background: c.kind === 'clock_in' ? 'var(--d-ok-bg)' : 'var(--d-info-bg)', color: c.kind === 'clock_in' ? 'var(--d-ok-ink)' : 'var(--d-info-ink)' }}><Icon name={c.kind === 'clock_in' ? 'arrowDown' : 'arrowUp'} size={14} /></div>
                  <div style={s('flex:1;min-width:0')}>
                    <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{CLOCK_KIND[c.kind] ?? c.kind} · {formatTime(c.occurred_at)}{c.carer ? ` · ${c.carer}` : ''}</div>
                    <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>
                      {c.distance_from_site_m != null ? `${c.distance_from_site_m} m from site` : 'no location'}
                      {ORIGIN_LABEL[c.origin] ? ` · ${ORIGIN_LABEL[c.origin]}` : ''}
                      {c.device ? ` · ${deviceLabel(c.device)}` : ''}
                      {c.ip_address ? ` · IP ${c.ip_address}` : ''}
                    </div>
                  </div>
                  {c.geofence_result && <Tag tone={c.geofence_result === 'pass' ? 'success' : c.geofence_result === 'fail' ? 'danger' : 'muted'}>{c.geofence_result.replace(/_/g, ' ')}</Tag>}
                </div>
              ))}
            </div>
          );
        })()}
      </Panel>

      {/* Tasks + notes from the visit. */}
      <Panel style={{ padding: '18px 20px' }}>
        <PanelTitle>Tasks &amp; notes</PanelTitle>
        {(() => {
          const tasks = assignments.flatMap((a) => a.tasks ?? []);
          const notes = assignments.flatMap((a) => (a.notes ?? []).map((n) => ({ ...n, carer: a.employee?.full_name })));
          const done = tasks.filter((t) => t.done).length;
          if (tasks.length === 0 && notes.length === 0) return <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);padding:6px 2px')}>No tasks or notes recorded for this visit.</div>;
          return (
            <div style={s('display:flex;flex-direction:column;gap:14px')}>
              {tasks.length > 0 && (
                <div style={s('display:flex;flex-direction:column;gap:8px')}>
                  <div style={hdr}>Tasks — {done}/{tasks.length} done</div>
                  {tasks.map((t) => (
                    <div key={t.id} style={s('display:flex;align-items:center;gap:9px;background:var(--d-panel);border-radius:12px;padding:10px 13px')}>
                      <span style={s(`width:18px;height:18px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none;background:${t.done ? 'var(--d-primary)' : 'var(--d-field)'};color:#fff`)}>{t.done && <Icon name="check" size={12} />}</span>
                      <span style={s(`font-size:13px;font-weight:600;color:var(--d-ink);${t.done ? '' : 'opacity:0.6'}`)}>{t.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {notes.length > 0 && (
                <div style={s('display:flex;flex-direction:column;gap:8px')}>
                  <div style={hdr}>Carer notes</div>
                  {notes.map((n) => (
                    <div key={n.id} style={s('background:var(--d-note-bg);border-radius:12px;padding:11px 14px;display:flex;flex-direction:column;gap:5px')}>
                      <div style={s('font-size:13px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>{n.body}</div>
                      <div style={s('font-size:11px;font-weight:600;color:var(--d-muted)')}>{n.author_name ?? n.carer ?? 'Unknown'} · {formatDate(n.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </Panel>

      {/* Care plan in force — what the visit is meant to deliver. */}
      {carePlan.length > 0 && (
        <Panel style={{ padding: '18px 20px' }}>
          <PanelTitle>Care plan</PanelTitle>
          <div style={s('display:flex;flex-direction:column;gap:8px')}>
            {carePlan.map((c) => (
              <div key={c.id} style={s('background:var(--d-panel);border-radius:12px;padding:11px 13px')}>
                <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{c.label}</div>
                {c.detail && <div style={s('font-size:12px;font-weight:500;color:var(--d-ink2);margin-top:2px;line-height:1.5')}>{c.detail}</div>}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
