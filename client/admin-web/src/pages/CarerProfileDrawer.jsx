import { useEffect, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { fullName } from '../api/format.js';
import { Avatar, Tag } from '../ds/console.jsx';
import {
  getCarerProfile, listCarerNotes, listCarerVisits, listCarerClockEvents,
  listCarerTimesheetLines, listCarerRequests,
} from '../api/index.js';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'notes', label: 'Notes' },
  { key: 'visits', label: 'Visits' },
  { key: 'timesheet', label: 'Timesheet' },
  { key: 'clock', label: 'Clock' },
  { key: 'requests', label: 'Requests' },
];

function fmt(iso, withTime = true) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', withTime
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}
const hrs = (m) => `${Math.floor((m ?? 0) / 60)}h ${(m ?? 0) % 60}m`;

// The carer 360: notes, visits, timesheet, clock history and requests for one
// carer. Reads the paginated /admin/employees/:id/* endpoints.
export default function CarerProfileDrawer({ carer, onClose }) {
  const [tab, setTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState({});         // per-tab loaded payload
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    getCarerProfile(carer.id).then((p) => active && setProfile(p)).catch(() => {});
    return () => { active = false; };
  }, [carer.id]);

  useEffect(() => {
    if (tab === 'overview' || data[tab]) return undefined;
    let active = true;
    setLoading(true);
    const loader = {
      notes: listCarerNotes, visits: listCarerVisits, timesheet: listCarerTimesheetLines,
      clock: listCarerClockEvents, requests: listCarerRequests,
    }[tab];
    loader(carer.id)
      .then((r) => { if (active) setData((d) => ({ ...d, [tab]: r.items ?? [] })); })
      .catch(() => { if (active) setData((d) => ({ ...d, [tab]: [] })); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, carer.id, data]);

  const rows = data[tab] ?? [];

  return (
    <div onClick={onClose} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.42);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:520px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
        <div style={s('padding:22px 24px 14px;border-bottom:1px solid var(--d-border);display:flex;align-items:center;gap:12px')}>
          <Avatar initials={`${carer.first_name?.[0] ?? ''}${carer.last_name?.[0] ?? ''}`} src={carer.avatar_url} />
          <div style={s('flex:1;min-width:0')}>
            <div style={s('font-size:17px;font-weight:700;color:var(--d-ink)')}>{fullName(carer)}</div>
            <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{carer.email}</div>
          </div>
          <div onClick={onClose} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
        </div>

        {/* Tabs */}
        <div style={s('display:flex;gap:4px;padding:10px 18px;border-bottom:1px solid var(--d-border);overflow-x:auto')}>
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              style={{ ...s('border:0;border-radius:9px;padding:7px 13px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap'), background: tab === t.key ? 'var(--d-pill)' : 'transparent', color: tab === t.key ? 'var(--d-pill-ink)' : 'var(--d-ink2)', fontFamily: 'inherit' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={s('flex:1;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:12px')}>
          {tab === 'overview' ? (
            !profile ? <Muted>Loading…</Muted> : (
              <>
                <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
                  {[
                    ['Hours this week', profile.employee?.hours_this_week != null ? `${profile.employee.hours_this_week}h` : '—'],
                    ['Punctuality', profile.employee?.punctuality != null ? `${profile.employee.punctuality}%` : '—'],
                  ].map(([l, v]) => (
                    <div key={l} style={s('background:var(--d-panel);border-radius:12px;padding:12px;text-align:center')}>
                      <div className="d-num" style={s('font-size:18px;font-weight:700;color:var(--d-ink)')}>{v}</div>
                      <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-top:2px')}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={s('display:grid;grid-template-columns:repeat(2,1fr);gap:8px')}>
                  {[['Visits', profile.counts?.visits], ['Upcoming', profile.counts?.upcoming], ['Notes', profile.counts?.notes], ['Open requests', profile.counts?.open_requests]].map(([l, v]) => (
                    <div key={l} style={s('background:var(--d-panel);border-radius:12px;padding:12px;text-align:center')}>
                      <div className="d-num" style={s('font-size:18px;font-weight:700;color:var(--d-ink)')}>{v ?? 0}</div>
                      <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-top:2px')}>{l}</div>
                    </div>
                  ))}
                </div>
                <Section title="Recent notes">
                  {(profile.recent_notes ?? []).length === 0 ? <Muted>No notes written yet.</Muted>
                    : profile.recent_notes.map((n) => <NoteCard key={n.id} n={n} />)}
                </Section>
              </>
            )
          ) : loading ? <Muted>Loading…</Muted>
            : rows.length === 0 ? <Muted>Nothing here yet.</Muted>
            : tab === 'notes' ? rows.map((n) => <NoteCard key={n.id} n={n} />)
            : tab === 'visits' ? rows.map((v) => (
                <Line key={v.id} title={v.visit?.service_user?.full_name || `Visit ${v.visit_id}`}
                  sub={`${fmt(v.visit?.scheduled_start)} · ${v.lifecycle_state?.replace(/_/g, ' ')}`} />
              ))
            : tab === 'timesheet' ? rows.map((l) => (
                <Line key={l.id} title={`${fmt(l.work_date, false)} — ${hrs(l.worked_minutes)} worked`}
                  sub={`Scheduled ${hrs(l.scheduled_minutes)} · Break ${hrs(l.break_minutes)}${l.approved_at ? ` · approved by ${l.approved_by}` : ''}`} />
              ))
            : tab === 'clock' ? rows.map((c) => (
                <Line key={c.id} title={`${c.kind?.replace(/_/g, ' ')} · ${fmt(c.occurred_at)}`}
                  sub={`${c.service_user ?? ''}${c.geofence_result ? ` · ${c.geofence_result.replace(/_/g, ' ')}` : ''}`} />
              ))
            : tab === 'requests' ? rows.map((r) => (
                <div key={r.id} style={s('background:var(--d-panel);border-radius:12px;padding:12px 14px')}>
                  <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px')}>
                    <span style={s('font-size:13px;font-weight:700;color:var(--d-ink);text-transform:capitalize')}>{r.kind}</span>
                    <Tag tone={r.state === 'pending' ? 'warning' : r.state === 'approved' ? 'success' : 'muted'}>{r.state}</Tag>
                  </div>
                  <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);margin-top:4px')}>{r.summary}</div>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}

function Muted({ children }) { return <div style={s('padding:30px 8px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>{children}</div>; }
function Section({ title, children }) {
  return (
    <div style={s('display:flex;flex-direction:column;gap:8px')}>
      <div style={s('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--d-muted)')}>{title}</div>
      {children}
    </div>
  );
}
function Line({ title, sub }) {
  return (
    <div style={s('background:var(--d-panel);border-radius:12px;padding:11px 14px')}>
      <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{title}</div>
      {sub && <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px;text-transform:capitalize')}>{sub}</div>}
    </div>
  );
}
function NoteCard({ n }) {
  return (
    <div style={s('background:var(--d-note-bg);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:5px')}>
      <div style={s('font-size:13px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>{n.body}</div>
      <div style={s('font-size:11px;font-weight:600;color:var(--d-muted)')}>
        {n.service_user ? `${n.service_user} · ` : ''}{fmt(n.visit_scheduled_start ?? n.created_at)}
      </div>
    </div>
  );
}
