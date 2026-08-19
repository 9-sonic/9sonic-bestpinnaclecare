import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { fullName } from '../api/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Panel, PanelTitle, Tag, Avatar, Button, SegTabs } from '../ds/console.jsx';
import {
  getEmployee, updateEmployee, uploadEmployeeAvatar, removeEmployeeAvatar,
  getEmployeeAvailability, getCarerProfile, listCarerNotes, listCarerVisits,
  listCarerClockEvents, listCarerRequests, resendEmployeeInvite,
} from '../api/index.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'notes', label: 'Notes' },
  { key: 'visits', label: 'Visits' },
  { key: 'clock', label: 'Clock history' },
  { key: 'requests', label: 'Requests' },
  { key: 'availability', label: 'Availability' },
];

const fmt = (iso, withTime = true) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', withTime
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

export default function CarerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { canManage } = useAuth();

  const [carer, setCarer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [tabData, setTabData] = useState({});
  const [resending, setResending] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const avatarInput = useRef(null);

  const load = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([getEmployee(id), getCarerProfile(id).catch(() => null)]);
      setCarer(e); setProfile(p);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Lazily load each tab's list the first time it's opened.
  useEffect(() => {
    if (['overview'].includes(tab) || tabData[tab]) return undefined;
    let active = true;
    setTabLoading(true);
    const loader = {
      notes: listCarerNotes, visits: listCarerVisits,
      clock: listCarerClockEvents, requests: listCarerRequests,
      availability: (i) => getEmployeeAvailability(i).then((rows) => ({ items: rows })),
    }[tab];
    loader(id)
      .then((r) => { if (active) setTabData((d) => ({ ...d, [tab]: r.items ?? [] })); })
      .catch(() => { if (active) setTabData((d) => ({ ...d, [tab]: [] })); })
      .finally(() => { if (active) setTabLoading(false); });
    return () => { active = false; };
  }, [tab, id, tabData]);

  if (loading) return <Spinner fullscreen />;
  if (!carer) return <div style={s('padding:40px;font-size:14px;color:var(--d-muted)')}>That employee could not be found. <Button size="sm" onClick={() => navigate('/employees')}>Back to employees</Button></div>;

  function openEdit() {
    setForm({ first_name: carer.first_name, last_name: carer.last_name, phone: carer.phone ?? '', employee_reference: carer.employee_reference ?? '' });
    setEditing(true);
  }
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    try { await updateEmployee(carer.id, form); toast.success('Staff record updated'); setEditing(false); await load(); }
    catch (e) { toast.error(e.message || 'Could not save'); } finally { setSaving(false); }
  }
  async function toggleActive() {
    try { await updateEmployee(carer.id, { active: !carer.active }); toast.success(carer.active ? 'Deactivated' : 'Reactivated'); await load(); }
    catch (e) { toast.error(e.message || 'Could not update'); }
  }
  async function resend() {
    setResending(true);
    try { await resendEmployeeInvite(carer.id); toast.success(`Invite re-sent to ${carer.email}`); await load(); }
    catch (e) { toast.error(e.message || 'Could not resend the invite'); }
    finally { setResending(false); }
  }
  async function onAvatar(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { await uploadEmployeeAvatar(carer.id, file); toast.success('Photo updated'); await load(); }
    catch (err) { toast.error(err.message || 'Could not upload'); }
  }
  async function removeAvatar() {
    try { await removeEmployeeAvatar(carer.id); toast.success('Photo removed'); await load(); }
    catch (e) { toast.error(e.message || 'Could not remove'); }
  }

  const rows = tabData[tab] ?? [];
  const inits = `${carer.first_name?.[0] ?? ''}${carer.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Profile header */}
      <Panel style={{ padding: '26px 28px' }}>
        <div style={s('display:flex;align-items:flex-start;gap:22px;flex-wrap:wrap')}>
          <div style={s('position:relative;flex:none')}>
            <Avatar initials={inits} src={carer.avatar_url} size={92} />
            {canManage && (
              <>
                <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatar} />
                <div onClick={() => avatarInput.current?.click()} title="Change photo" className="hv"
                  style={{ ...s('position:absolute;bottom:0;right:0;width:30px;height:30px;border-radius:50%;background:var(--d-card);border:1.5px solid var(--d-border);display:flex;align-items:center;justify-content:center;cursor:pointer'), '--hbg': 'var(--d-panel)' }}>
                  <Icon name="edit" size={14} />
                </div>
              </>
            )}
          </div>
          <div style={s('flex:1;min-width:0')}>
            <div style={s('display:flex;align-items:center;gap:11px;flex-wrap:wrap')}>
              <div style={s('font-size:27px;font-weight:700;letter-spacing:-0.5px;color:var(--d-ink)')}>{fullName(carer)}</div>
              <Tag tone={!carer.active ? 'muted' : carer.invite_pending ? 'warning' : 'success'}>{!carer.active ? 'Inactive' : carer.invite_pending ? 'Invite pending' : 'Active'}</Tag>
              {carer.mfa_enabled && <Tag tone="info">MFA on</Tag>}
            </div>
            <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;font-weight:500;color:var(--d-muted);margin-top:5px')}>
              <span>{carer.email}</span>
              {carer.employee_reference && <><span style={s('opacity:0.5')}>·</span><span>{carer.employee_reference}</span></>}
              {carer.phone && <><span style={s('opacity:0.5')}>·</span><span style={s('display:inline-flex;align-items:center;gap:5px')}><Icon name="phone" size={13} />{carer.phone}</span></>}
            </div>
          </div>
          {canManage && (
            <div style={s('display:flex;gap:8px;flex:none;flex-wrap:wrap;justify-content:flex-end')}>
              {carer.active && carer.invite_pending && <Button size="sm" icon="send" disabled={resending} onClick={resend}>{resending ? 'Sending…' : 'Resend invite'}</Button>}
              <Button size="sm" icon="edit" onClick={openEdit}>Edit</Button>
              <Button size="sm" variant={carer.active ? 'danger' : 'ghost'} onClick={toggleActive}>{carer.active ? 'Deactivate' : 'Reactivate'}</Button>
              {carer.avatar_url && <Button size="sm" onClick={removeAvatar}>Remove photo</Button>}
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:20px')}>
          {/* Stats live on the profile payload (Staff::Stats merge), not on the
              bare #show employee — read them from there. */}
          {(() => { const st = profile?.employee ?? carer; return [
            ['Hours this week', st.hours_this_week != null ? `${st.hours_this_week}h` : '—'],
            ['Punctuality', st.punctuality != null ? `${st.punctuality}%` : '—'],
            ['Contracted', carer.contracted_hours_per_week ? `${carer.contracted_hours_per_week}h` : '—'],
          ]; })().map(([l, v]) => (
            <div key={l} style={s('background:var(--d-panel);border-radius:14px;padding:14px 16px')}>
              <div className="d-num" style={s('font-size:22px;font-weight:700;color:var(--d-ink);line-height:1')}>{v}</div>
              <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em;margin-top:6px')}>{l}</div>
            </div>
          ))}
        </div>

        {editing && (
          <div style={s('margin-top:18px;padding-top:18px;border-top:1px solid var(--d-border);display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:end')}>
            <L label="First name"><input style={inp} value={form.first_name} onChange={setField('first_name')} /></L>
            <L label="Last name"><input style={inp} value={form.last_name} onChange={setField('last_name')} /></L>
            <L label="Phone"><input style={inp} value={form.phone} onChange={setField('phone')} /></L>
            <L label="Staff reference"><input style={inp} value={form.employee_reference} onChange={setField('employee_reference')} /></L>
            <div style={s('display:flex;gap:8px')}>
              <Button variant="primary" onClick={saving ? undefined : save}>{saving ? 'Saving…' : 'Save'}</Button>
              <Button onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Tabs */}
      <SegTabs tabs={TABS.map((t) => ({ key: t.key, label: t.label }))} active={tab} onSelect={setTab} />

      <Panel style={{ padding: '18px 20px' }}>
        {tab === 'overview' ? (
          !profile ? <Muted>No summary available.</Muted> : (
            <div style={s('display:flex;flex-direction:column;gap:16px')}>
              <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px')}>
                {[['Visits', profile.counts?.visits], ['Upcoming', profile.counts?.upcoming], ['Notes', profile.counts?.notes], ['Open requests', profile.counts?.open_requests]].map(([l, v]) => (
                  <div key={l} style={s('background:var(--d-panel);border-radius:12px;padding:14px;text-align:center')}>
                    <div className="d-num" style={s('font-size:20px;font-weight:700;color:var(--d-ink)')}>{v ?? 0}</div>
                    <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-top:2px')}>{l}</div>
                  </div>
                ))}
              </div>
              <div>
                <PanelTitle>Recent notes</PanelTitle>
                {(profile.recent_notes ?? []).length === 0 ? <Muted>No notes yet.</Muted>
                  : profile.recent_notes.map((n) => <NoteCard key={n.id} n={n} />)}
              </div>
            </div>
          )
        ) : tabLoading ? <Muted>Loading…</Muted>
          : rows.length === 0 ? <Muted>Nothing here yet.</Muted>
          : tab === 'notes' ? rows.map((n) => <NoteCard key={n.id} n={n} />)
          : tab === 'visits' ? rows.map((v) => <Line key={v.id} title={v.visit?.service_user?.full_name || `Visit ${v.visit_id}`} sub={`${fmt(v.visit?.scheduled_start)} · ${v.lifecycle_state?.replace(/_/g, ' ')}`} />)
          : tab === 'clock' ? rows.map((c) => <Line key={c.id} title={`${c.kind?.replace(/_/g, ' ')} · ${fmt(c.occurred_at)}`} sub={`${c.service_user ?? ''}${c.geofence_result ? ` · ${c.geofence_result.replace(/_/g, ' ')}` : ''}`} />)
          : tab === 'requests' ? rows.map((r) => (
              <div key={r.id} style={s('background:var(--d-panel);border-radius:12px;padding:12px 14px;margin-bottom:8px')}>
                <div style={s('display:flex;align-items:center;justify-content:space-between;gap:8px')}>
                  <span style={s('font-size:13px;font-weight:700;color:var(--d-ink);text-transform:capitalize')}>{r.kind}</span>
                  <Tag tone={r.state === 'pending' ? 'warning' : r.state === 'approved' ? 'success' : 'muted'}>{r.state}</Tag>
                </div>
                <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);margin-top:4px')}>{r.summary}</div>
              </div>
            ))
          : tab === 'availability' ? [0, 1, 2, 3, 4, 5, 6].map((wd) => {
              const slots = rows.filter((a) => a.weekday === wd && a.available);
              return (
                <div key={wd} style={s('display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:12px;background:var(--d-panel);margin-bottom:8px')}>
                  <div style={s('width:96px;flex:none;font-size:13px;font-weight:700;color:var(--d-ink)')}>{DAYS[wd]}</div>
                  <div style={s('flex:1;display:flex;gap:6px;flex-wrap:wrap')}>
                    {slots.length === 0 ? <span style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Not available</span>
                      : slots.map((a) => <Tag key={a.id ?? a.slot} tone="success">{String(a.slot).replace(/_/g, ' ')}</Tag>)}
                  </div>
                </div>
              );
            })
          : null}
      </Panel>
    </div>
  );
}

const inp = { ...s('height:40px;border-radius:11px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13.5px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };
function L({ label, children }) {
  return <label style={s('display:flex;flex-direction:column;gap:6px')}><span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>{label}</span>{children}</label>;
}
function Muted({ children }) { return <div style={s('padding:30px 8px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>{children}</div>; }
function Line({ title, sub }) {
  return (
    <div style={s('background:var(--d-panel);border-radius:12px;padding:11px 14px;margin-bottom:8px')}>
      <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{title}</div>
      {sub && <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px;text-transform:capitalize')}>{sub}</div>}
    </div>
  );
}
function NoteCard({ n }) {
  return (
    <div style={s('background:var(--d-note-bg);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:5px;margin-bottom:8px')}>
      <div style={s('font-size:13px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>{n.body}</div>
      <div style={s('font-size:11px;font-weight:600;color:var(--d-muted)')}>{n.service_user ? `${n.service_user} · ` : ''}{fmt(n.visit_scheduled_start ?? n.created_at)}</div>
    </div>
  );
}
