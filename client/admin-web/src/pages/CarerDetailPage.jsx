import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s, imageTooLarge } from '../lib/ui.jsx';
import { fullName, formatTime, minutesToHours } from '../api/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Panel, Tag, Avatar, Button, SegTabs, FilterBar, SearchBox, SelectField,
  DateField, Pager, TableWrap, Th, Td, Row,
} from '../ds/console.jsx';
import {
  getEmployee, updateEmployee, uploadEmployeeAvatar, removeEmployeeAvatar,
  getCarerProfile, listCarerNotes, listCarerVisits,
  listCarerClockEvents, listCarerRequests, listCarerMileage, resendEmployeeInvite,
} from '../api/index.js';


// The five record streams, unified into one filterable table. Each knows: how to
// fetch it, its date column (for the range filter), whether it can be scoped to a
// client, whether it has free text, and how to turn a row into the shared table
// shape { date, title, sub, meta, right, tone }.
const VISIT_TONE = {
  completed: 'success', in_progress: 'info', scheduled: 'muted',
  check_in_window: 'info', grace_period: 'warning', late: 'warning',
  missed: 'danger', overdue: 'danger', pending_review: 'warning', cancelled: 'muted',
};
// How the tap reached us. offline_sync = queued on the phone with no signal and
// sent later; manual_admin = a manager entered it. 'live' needs no label.
const ORIGIN_LABEL = { offline_sync: 'Offline — synced later', manual_admin: 'Entered by office' };

const metresLabel = (m) => (m < 1000 ? `${m} m away` : `${(m / 1000).toFixed(1)} km away`);
// The device a tap came from — platform + app version, else short fingerprint.
const deviceLabel = (d) => {
  if (!d) return '';
  if (d.platform) return `${d.platform}${d.app_version ? ` ${d.app_version}` : ''}`;
  return `device ${String(d.fingerprint).slice(0, 8)}`;
};
const syncGapMin = (occurred, recorded) => {
  const o = new Date(occurred).getTime(); const r = new Date(recorded).getTime();
  return (!o || !r || r <= o) ? 0 : Math.round((r - o) / 60000);
};
const syncGapLabel = (occurred, recorded) => {
  const min = syncGapMin(occurred, recorded);
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
};

const fmt = (iso, withTime = true) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', withTime
      ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }
      : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
  } catch { return iso; }
};

// Each stream declares its OWN columns so the table reads correctly for that
// record — a visit table has a Client column, a clock table has Location, etc.
// cols: header labels; toRow returns cells[] aligned to them + right (status) +
// visitId (drill-in) + when (the date cell string).
const ACTIVITY_TYPES = {
  visits: {
    label: 'Visits', icon: 'calendar', fetch: listCarerVisits, hasClient: true, hasText: false,
    cols: ['Date', 'Client', 'Actual', 'Status'],
    dateOf: (v) => v.visit?.scheduled_start,
    toRow: (v) => ({
      visitId: v.visit_id,
      when: fmt(v.visit?.scheduled_start, false),
      cells: [
        v.visit?.service_user?.full_name || `Visit ${v.visit_id}`,
        [
          (v.actual_start || v.actual_end)
            ? `${v.actual_start ? formatTime(v.actual_start) : '—'}–${v.actual_end ? formatTime(v.actual_end) : (v.actual_start ? 'open' : '—')}`
            : 'Not started',
          v.worked_minutes != null ? `${minutesToHours(v.worked_minutes)} worked` : null,
          ...((v.flags ?? []).map((f) => f.replace(/_/g, ' '))),
        ].filter(Boolean).join(' · '),
      ],
      right: <Tag tone={VISIT_TONE[v.lifecycle_state] ?? 'muted'}>{(v.lifecycle_state ?? '').replace(/_/g, ' ')}</Tag>,
    }),
  },
  notes: {
    label: 'Notes', icon: 'note', fetch: listCarerNotes, hasClient: true, hasText: true,
    cols: ['Date', 'Client', 'Note', ''],
    dateOf: (n) => n.visit_scheduled_start ?? n.created_at,
    toRow: (n) => ({
      visitId: n.visit_id,
      when: fmt(n.visit_scheduled_start ?? n.created_at, false),
      cells: [n.service_user || '—', n.body],
      right: null,
    }),
  },
  clock: {
    label: 'Clock', icon: 'clock', fetch: listCarerClockEvents, hasClient: true, hasText: false,
    cols: ['Time', 'Client', 'Location', 'Result'],
    dateOf: (c) => c.occurred_at,
    toRow: (c) => ({
      visitId: c.visit_id,
      when: fmt(c.occurred_at, true),
      cells: [
        `${(c.kind ?? '').replace(/_/g, ' ')}${c.service_user ? ` · ${c.service_user}` : ''}`,
        [
          c.distance_from_site_m != null ? metresLabel(c.distance_from_site_m) : null,
          ORIGIN_LABEL[c.origin] || null,
          (c.method && c.method !== 'gps') ? c.method.replace(/_/g, ' ') : null,
          c.device ? deviceLabel(c.device) : null,
          c.ip_address ? `IP ${c.ip_address}` : null,
          (c.recorded_at && syncGapMin(c.occurred_at, c.recorded_at) >= 2) ? `synced ${syncGapLabel(c.occurred_at, c.recorded_at)} later` : null,
        ].filter(Boolean).join(' · ') || '—',
      ],
      right: c.geofence_result ? <Tag tone={c.geofence_result === 'pass' ? 'success' : c.geofence_result === 'fail' ? 'danger' : 'muted'}>{c.geofence_result.replace(/_/g, ' ')}</Tag> : null,
    }),
  },
  requests: {
    label: 'Requests', icon: 'chat', fetch: listCarerRequests, hasClient: false, hasText: true,
    cols: ['Date', 'Type', 'Detail', 'State'],
    dateOf: (r) => r.created_at,
    toRow: (r) => ({
      when: fmt(r.created_at, false),
      cells: [
        (r.kind ?? '').replace(/_/g, ' '),
        [r.summary, r.decision_note ? `“${r.decision_note}”` : (r.detail || null)].filter(Boolean).join(' — '),
      ],
      right: <Tag tone={r.state === 'pending' ? 'warning' : r.state === 'approved' ? 'success' : 'muted'}>{r.state}</Tag>,
    }),
  },
  mileage: {
    label: 'Mileage', icon: 'pin', fetch: listCarerMileage, hasClient: true, hasText: false,
    cols: ['Date', 'Journey', 'Client', 'Miles'],
    dateOf: (m) => m.travel_date,
    toRow: (m) => ({
      when: fmt(m.travel_date, false),
      cells: [
        (m.from_label || m.to_label) ? `${m.from_label ?? '—'} → ${m.to_label ?? '—'}` : 'Travel',
        m.service_user || '—',
      ],
      right: (
        <span style={s('display:flex;flex-direction:column;align-items:flex-end;gap:4px')}>
          <span className="d-num" style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{Number(m.miles).toFixed(1)} mi</span>
          {m.state && <Tag tone={m.state === 'approved' ? 'success' : m.state === 'rejected' ? 'danger' : 'muted'}>{m.state}</Tag>}
        </span>
      ),
    }),
  },
};

const PER_PAGE = 25;

export default function CarerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { canManage } = useAuth();

  const [carer, setCarer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);

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
    const tooBig = imageTooLarge(file);
    if (tooBig) { toast.error(tooBig); return; }
    try { await uploadEmployeeAvatar(carer.id, file); toast.success('Photo updated'); await load(); }
    catch (err) { toast.error(err.message || 'Could not upload'); }
  }
  async function removeAvatar() {
    try { await removeEmployeeAvatar(carer.id); toast.success('Photo removed'); await load(); }
    catch (e) { toast.error(e.message || 'Could not remove'); }
  }

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
                <div onClick={() => avatarInput.current?.click()} className="hv tip" data-tip="Change photo"
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
              {carer.avatar_url && <Button variant="ghost" size="sm" onClick={removeAvatar}>Remove photo</Button>}
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:20px')}>
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

      {/* The five record streams are the main tabs (Visits/Notes/Clock/Requests/
          Mileage) — CarerActivity owns its own type SegTabs + filters + table. */}
      <CarerActivity carerId={id} />
    </div>
  );
}

/* --------------------------- Activity table ------------------------------- */
// One table across all five record streams. All filtering happens SERVER-SIDE
// (date range, client, text) so any record from any point in history is
// reachable — not just the first page. Previously this was five separate card
// lists that each loaded one page and dead-ended, so "a visit from last year"
// was unreachable.
function CarerActivity({ carerId }) {
  const navigate = useNavigate();
  const [type, setType] = useState('visits');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [client, setClient] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState([]);  // client filter options, learned from results
  const [loading, setLoading] = useState(true);

  const def = ACTIVITY_TYPES[type];

  const onFrom = (v) => setFrom(v);
  const onTo = (v) => setTo(v);

  // Reset the page whenever a non-page filter changes, so you never land on an
  // empty page after narrowing.
  useEffect(() => { setPage(1); }, [type, from, to, client, q]);

  // Debounce the text box so we don't fire a request per keystroke.
  const [qDebounced, setQDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setQDebounced(q), 300); return () => clearTimeout(t); }, [q]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = { page, per_page: PER_PAGE };
    if (from) params.from = from;
    if (to) params.to = to;
    if (def.hasClient && client) params.service_user_id = client;
    if (def.hasText && qDebounced.trim()) params.q = qDebounced.trim();
    def.fetch(carerId, params)
      .then((r) => {
        if (!active) return;
        setRows(r.items ?? []);
        setTotal(r.total ?? 0);
        // Learn client options from whatever rows we see (no dedicated endpoint).
        if (def.hasClient) {
          setClients((prev) => {
            const m = new Map(prev.map((c) => [c.id, c.label]));
            (r.items ?? []).forEach((row) => {
              const name = row.service_user || row.visit?.service_user?.full_name;
              const cid = row.visit?.service_user?.id ?? name;
              if (name && cid != null) m.set(cid, name);
            });
            return [...m.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => String(a.label).localeCompare(b.label));
          });
        }
      })
      .catch(() => { if (active) { setRows([]); setTotal(0); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [carerId, type, page, from, to, client, qDebounced, def]);

  const tableRows = useMemo(() => rows.map((r) => ({ id: r.id, ...def.toRow(r) })), [rows, def]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={s('display:flex;flex-direction:column;gap:14px')}>
      <SegTabs
        tabs={Object.entries(ACTIVITY_TYPES).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon }))}
        active={type} onSelect={setType}
      />
      <Panel style={{ padding: '14px 16px' }}>
        <FilterBar>
          <DateField label="From" value={from} onChange={onFrom} max={to || today} />
          <DateField label="To" value={to} onChange={onTo} min={from} max={today} />
          {def.hasClient && <SelectField label="Client" value={client} onChange={setClient} options={clients} allLabel="All clients" minWidth={170} />}
          {def.hasText && <div style={s('flex:1;min-width:180px')}><SearchBox value={q} onChange={setQ} placeholder={`Search ${def.label.toLowerCase()}`} /></div>}
        </FilterBar>
      </Panel>

      <Panel style={{ padding: '6px 6px 4px' }}>
        {loading ? <Muted>Loading…</Muted>
          : tableRows.length === 0 ? <Muted>No {def.label.toLowerCase()} match these filters.</Muted>
          : (
            <TableWrap minWidth={680}>
              <thead><tr>
                {def.cols.map((c, i) => <Th key={c || i}>{c}</Th>)}
                <Th> </Th>
              </tr></thead>
              <tbody>
                {tableRows.map((r) => {
                  const open = r.visitId ? () => navigate(`/visits/${r.visitId}`) : undefined;
                  return (
                    // A record tied to a visit opens that visit's full record; the
                    // chevron makes the row read as a doorway, not a dead line.
                    <Row key={r.id} onClick={open}>
                      <Td mono nowrap>{r.when}</Td>
                      {r.cells.map((cell, i) => (
                        <Td key={i} nowrap={i === 0}>
                          <span style={s(`font-size:13px;color:var(--d-ink);${i === 0 ? 'font-weight:700;text-transform:capitalize' : 'font-weight:500;color:var(--d-ink2)'}`)}>{cell}</span>
                        </Td>
                      ))}
                      <Td>{r.right ?? null}</Td>
                      <Td align="right">{open && <Icon name="chevronRight" size={16} style={{ color: 'var(--d-faint)' }} />}</Td>
                    </Row>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
      </Panel>
      {total > PER_PAGE && <Pager page={page} perPage={PER_PAGE} total={total} onPage={setPage} />}
    </div>
  );
}

const inp = { ...s('height:40px;border-radius:11px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13.5px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };
function L({ label, children }) {
  return <label style={s('display:flex;flex-direction:column;gap:6px')}><span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>{label}</span>{children}</label>;
}
function Muted({ children }) { return <div style={s('padding:30px 8px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>{children}</div>; }
