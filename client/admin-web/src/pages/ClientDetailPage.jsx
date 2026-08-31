import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { fullName, addressOf } from '../api/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Panel, Tag, Avatar, Button, SegTabs, FilterBar, SearchBox, SelectField, DateField, Pager, TableWrap, Th, Td, Row } from '../ds/console.jsx';
import { getServiceUser, updateServiceUser, listServiceUserNotes, listServiceUserVisits, listCarePackages, listCarePlanItems, createCarePlanItem, updateCarePlanItem, deleteCarePlanItem } from '../api/index.js';

const TABS = [
  { key: 'schedule', label: 'Schedule' },
  { key: 'visits', label: 'Visits' },
  { key: 'notes', label: 'Visit notes' },
];

const VISIT_TONE = {
  completed: 'success', in_progress: 'info', scheduled: 'muted', check_in_window: 'info',
  grace_period: 'warning', late: 'warning', missed: 'danger', overdue: 'danger',
  pending_review: 'warning', cancelled: 'muted',
};
const VISITS_PER_PAGE = 25;

// Recurrence is stored free-text: 'daily'/empty = every day, else a space/comma
// list of these short day codes (see Visits::GenerateFromCarePackages). Render it
// as human day names in week order.
const DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_FULL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
function recurrenceLabel(rec) {
  const r = (rec ?? '').toString().toLowerCase().trim();
  if (!r || r === 'daily') return 'Every day';
  const days = r.split(/[,\s]+/).filter(Boolean);
  const ordered = DAY_CODES.filter((d) => days.includes(d));
  if (ordered.length === 7) return 'Every day';
  if (ordered.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => ordered.includes(d))) return 'Weekdays';
  return ordered.map((d) => DAY_FULL[d]).join(', ') || r;
}
const fmtDate = (iso) => { if (!iso) return null; try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; } };

const EMPTY = {
  first_name: '', last_name: '', reference: '', council_id: '', phone: '',
  address_line1: '', address_line2: '', city: '', postcode: '',
  lat: '', lng: '', access_notes: '',
};
const fmtNoteDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }); }
  catch { return iso; }
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { canManage } = useAuth();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('schedule');

  const [schedule, setSchedule] = useState(null);
  const [notes, setNotes] = useState(null);
  const [noteQuery, setNoteQuery] = useState('');
  const [noteCarer, setNoteCarer] = useState('');
  const [noteFrom, setNoteFrom] = useState('');
  const [noteTo, setNoteTo] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setClient(await getServiceUser(id)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'schedule' || schedule) return;
    listCarePackages({ service_user_id: id })
      .then((r) => setSchedule(r.items ?? []))
      .catch(() => setSchedule([]));
  }, [tab, id, schedule]);

  useEffect(() => {
    if (tab !== 'notes') return undefined;
    let active = true;
    setNotesLoading(true);
    const filters = {};
    if (noteQuery.trim()) filters.q = noteQuery.trim();
    if (noteCarer) filters.employee_id = noteCarer;
    if (noteFrom) filters.from = noteFrom;
    if (noteTo) filters.to = noteTo;
    listServiceUserNotes(id, filters)
      .then((r) => active && setNotes(r.notes ?? []))
      .catch(() => active && setNotes([]))
      .finally(() => active && setNotesLoading(false));
    return () => { active = false; };
  }, [tab, id, noteQuery, noteCarer, noteFrom, noteTo]);

  const noteCarers = useMemo(() => {
    const m = new Map();
    (notes ?? []).forEach((n) => { if (n.employee_id) m.set(n.employee_id, n.employee_name); });
    return [...m.entries()].map(([eid, name]) => ({ id: eid, name }));
  }, [notes]);

  if (loading) return <Spinner fullscreen />;
  if (!client) return <div style={s('padding:40px;font-size:14px;color:var(--d-muted)')}>That client could not be found. <Button size="sm" onClick={() => navigate('/clients')}>Back to clients</Button></div>;

  function openEdit() { setForm({ ...EMPTY, ...client, lat: client.lat ?? '', lng: client.lng ?? '' }); setEditing(true); }
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function save() {
    setSaving(true);
    const payload = { ...form, lat: form.lat === '' ? null : Number(form.lat), lng: form.lng === '' ? null : Number(form.lng) };
    try { await updateServiceUser(client.id, payload); toast.success('Record updated'); setEditing(false); await load(); }
    catch (e) { toast.error(e.message || 'Could not save'); } finally { setSaving(false); }
  }
  async function toggleActive() {
    try { await updateServiceUser(client.id, { active: !client.active }); toast.success(client.active ? 'Archived' : 'Reactivated'); await load(); }
    catch (e) { toast.error(e.message || 'Could not update'); }
  }


  const inits = `${client.first_name?.[0] ?? ''}${client.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <Panel style={{ padding: '26px 28px' }}>
        <div style={s('display:flex;align-items:flex-start;gap:22px;flex-wrap:wrap')}>
          <Avatar initials={inits} size={92} />
          <div style={s('flex:1;min-width:0')}>
            <div style={s('display:flex;align-items:center;gap:11px;flex-wrap:wrap')}>
              <div style={s('font-size:27px;font-weight:700;letter-spacing:-0.5px;color:var(--d-ink)')}>{fullName(client)}</div>
              <Tag tone={client.active ? 'success' : 'muted'}>{client.active ? 'Active' : 'Archived'}</Tag>
            </div>
            <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;font-weight:500;color:var(--d-muted);margin-top:5px')}>
              <span>{client.reference ?? 'No reference'}</span>
              {client.council_id && <><span style={s('opacity:0.5')}>·</span><span title="Local authority ID">Council ID {client.council_id}</span></>}
              {client.phone && <><span style={s('opacity:0.5')}>·</span><span style={s('display:inline-flex;align-items:center;gap:5px')}><Icon name="phone" size={13} />{client.phone}</span></>}
            </div>
            <div style={s('font-size:13.5px;font-weight:500;color:var(--d-ink2);margin-top:9px;display:flex;align-items:center;gap:7px')}><Icon name="pin" size={15} />{addressOf(client) || 'No address on file'}</div>
          </div>
          {canManage && (
            <div style={s('display:flex;gap:8px;flex:none')}>
              <Button size="sm" icon="edit" onClick={openEdit}>Edit</Button>
              <Button size="sm" variant={client.active ? 'danger' : 'ghost'} onClick={toggleActive}>{client.active ? 'Archive' : 'Reactivate'}</Button>
            </div>
          )}
        </div>

        {/* Stat strip — one card row, aligned and evenly weighted. */}
        <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:20px')}>
          {[['Visits / week', client.visits_per_week ?? 0],
            ['Adherence', client.adherence == null ? '—' : `${client.adherence}%`],
            ['Regular carers', (client.carers ?? []).length]].map(([l, v]) => (
            <div key={l} style={s('background:var(--d-panel);border-radius:14px;padding:14px 16px')}>
              <div className="d-num" style={s('font-size:22px;font-weight:700;color:var(--d-ink);line-height:1')}>{v}</div>
              <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em;margin-top:6px')}>{l}</div>
            </div>
          ))}
        </div>

        {editing && (
          <div style={s('margin-top:18px;padding-top:18px;border-top:1px solid var(--d-border);display:flex;flex-direction:column;gap:12px')}>
            <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
              <L label="First name"><input style={inp} value={form.first_name} onChange={setField('first_name')} /></L>
              <L label="Last name"><input style={inp} value={form.last_name} onChange={setField('last_name')} /></L>
              <L label="Reference"><input style={inp} value={form.reference} onChange={setField('reference')} /></L>
              <L label="Council ID"><input style={inp} value={form.council_id} onChange={setField('council_id')} /></L>
              <L label="Phone"><input style={inp} value={form.phone} onChange={setField('phone')} /></L>
              <L label="Address line 1"><input style={inp} value={form.address_line1} onChange={setField('address_line1')} /></L>
              <L label="City"><input style={inp} value={form.city} onChange={setField('city')} /></L>
              <L label="Postcode"><input style={inp} value={form.postcode} onChange={setField('postcode')} /></L>
              <L label="Latitude"><input style={inp} value={form.lat} onChange={setField('lat')} placeholder="53.4808" /></L>
              <L label="Longitude"><input style={inp} value={form.lng} onChange={setField('lng')} placeholder="-2.2426" /></L>
            </div>
            <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);line-height:1.45')}>Carers can only clock in at these coordinates, within 150&nbsp;m. Keep them accurate so the fence enforces correctly.</div>
            <L label="Access notes for carers"><textarea rows={2} style={{ ...inp, height: 'auto', padding: '10px 13px' }} value={form.access_notes} onChange={setField('access_notes')} /></L>

            {/* Care plan — add / edit / remove the client's care tasks in place.
                Saves immediately (each row is its own resource), separate from the
                profile-detail Save below. */}
            <div style={s('padding-top:14px;border-top:1px solid var(--d-border)')}>
              <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink2);margin-bottom:10px')}>Care plan</div>
              <CarePlanEditor clientId={client.id} />
            </div>

            <div style={s('display:flex;gap:8px')}>
              <Button variant="primary" onClick={saving ? undefined : save}>{saving ? 'Saving…' : 'Save details'}</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Done</Button>
            </div>
          </div>
        )}
      </Panel>

      <SegTabs tabs={TABS.map((t) => ({ key: t.key, label: t.label }))} active={tab} onSelect={setTab} />

      {tab === 'schedule' && <ScheduleTab slots={schedule} />}

      {tab === 'visits' && <ClientVisitsTab clientId={id} onOpen={(vid) => navigate(`/visits/${vid}`)} />}

      {tab === 'notes' && (
        <NotesTab
          notes={notes} loading={notesLoading}
          query={noteQuery} setQuery={setNoteQuery}
          carer={noteCarer} setCarer={setNoteCarer} carers={noteCarers}
          from={noteFrom} setFrom={setNoteFrom} to={noteTo} setTo={setNoteTo}
        />
      )}
    </div>
  );
}

/* ------------------------------ Schedule tab ------------------------------ */
// The client's recurring contracted calls (care package slots). The nightly
// generator expands each of these into dated visits — so this is the source of
// truth for "who should visit this client, when, how often". Read-only here;
// editing lives with rota/scheduling, not the client record.
function ScheduleTab({ slots }) {
  if (slots == null) return <Panel><Muted>Loading…</Muted></Panel>;
  if (slots.length === 0) return <Panel><Muted>No recurring calls set up for this client yet.</Muted></Panel>;
  // Active first, then by start time (the API already orders by start_time).
  const ordered = [...slots].sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));
  return (
    <Panel style={{ padding: '16px 18px' }}>
      <div style={s('display:flex;flex-direction:column;gap:8px')}>
        {ordered.map((sl) => (
          <div key={sl.id} style={{ ...s('background:var(--d-panel);border-radius:12px;padding:12px 14px;display:flex;align-items:flex-start;gap:12px'), opacity: sl.active ? 1 : 0.55 }}>
            <div style={{ ...s('width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none'), background: 'var(--d-info-bg)', color: 'var(--d-info-ink)' }}><Icon name="clock" size={17} /></div>
            <div style={s('flex:1;min-width:0')}>
              <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
                <span style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>{sl.name || 'Call'}</span>
                <span style={s('font-size:13px;font-weight:600;color:var(--d-ink2)')}>{sl.start_time}–{sl.end_time}</span>
                {!sl.active && <Tag tone="muted">Inactive</Tag>}
              </div>
              <div style={s('display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;font-weight:600;color:var(--d-muted);margin-top:5px')}>
                <span>{recurrenceLabel(sl.recurrence)}</span>
                <span>· {sl.staff_required} carer{sl.staff_required === 1 ? '' : 's'}</span>
                {sl.break_minutes > 0 && <span>· {sl.break_minutes} min break</span>}
                {(sl.effective_from || sl.effective_to) && (
                  <span>· {fmtDate(sl.effective_from) ?? 'start'}{sl.effective_to ? ` – ${fmtDate(sl.effective_to)}` : ' onwards'}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------ Visits tab -------------------------------- */
// This client's visits — who attended, when — server-filtered by carer + date so
// any visit from any point in history is reachable ("which carer attended last
// March"). Each row opens the visit as a full record.
function ClientVisitsTab({ clientId, onOpen }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [carer, setCarer] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [carers, setCarers] = useState([]);   // carer options, learned from results
  const [loading, setLoading] = useState(true);

  const onFrom = (v) => setFrom(v);
  const onTo = (v) => setTo(v);

  useEffect(() => { setPage(1); }, [from, to, carer]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = { page, per_page: VISITS_PER_PAGE };
    if (from) params.from = from;
    if (to) params.to = to;
    if (carer) params.employee_id = carer;
    listServiceUserVisits(clientId, params)
      .then((r) => {
        if (!active) return;
        setRows(r.items ?? []);
        setTotal(r.total ?? 0);
        setCarers((prev) => {
          const m = new Map(prev.map((c) => [c.id, c.label]));
          (r.items ?? []).forEach((v) => (v.carers ?? []).forEach((c) => { if (c.employee_id && c.employee_name) m.set(c.employee_id, c.employee_name); }));
          return [...m.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => String(a.label).localeCompare(b.label));
        });
      })
      .catch(() => { if (active) { setRows([]); setTotal(0); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clientId, page, from, to, carer]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={s('display:flex;flex-direction:column;gap:14px')}>
      <Panel style={{ padding: '14px 16px' }}>
        <FilterBar>
          <DateField label="From" value={from} onChange={onFrom} max={to || today} />
          <DateField label="To" value={to} onChange={onTo} min={from} max={today} />
          <SelectField label="Carer" value={carer} onChange={setCarer} options={carers} allLabel="All carers" minWidth={170} />
        </FilterBar>
      </Panel>
      <Panel style={{ padding: '6px 6px 4px' }}>
        {loading ? <Muted>Loading…</Muted>
          : rows.length === 0 ? <Muted>No visits match these filters.</Muted>
          : (
            <TableWrap minWidth={720}>
              <thead><tr><Th>Date</Th><Th>Scheduled</Th><Th>Carer(s) attended</Th><Th>Actual</Th><Th>Status</Th><Th> </Th></tr></thead>
              <tbody>
                {rows.map((v) => {
                  const c0 = v.carers?.[0];
                  const st = v.status === 'cancelled' ? 'cancelled' : (c0?.lifecycle_state ?? 'scheduled');
                  const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : null);
                  const actual = c0?.actual_start
                    ? `${hhmm(c0.actual_start)}–${c0.actual_end ? hhmm(c0.actual_end) : 'open'}${c0.worked_minutes != null ? ` · ${Math.round(c0.worked_minutes / 60 * 10) / 10}h` : ''}`
                    : '—';
                  return (
                    <Row key={v.id} onClick={() => onOpen(v.id)}>
                      <Td mono nowrap>{fmtDate(v.scheduled_start)}</Td>
                      <Td mono nowrap>{hhmm(v.scheduled_start) ?? '—'}–{hhmm(v.scheduled_end) ?? '—'}</Td>
                      <Td nowrap>
                        {(v.carers ?? []).length === 0 ? <span style={s('color:var(--d-faint)')}>Unassigned</span>
                          : (v.carers.map((c) => c.employee_name).filter(Boolean).join(', ') || 'Unassigned')}
                      </Td>
                      <Td mono nowrap style={{ color: c0?.actual_start ? 'var(--d-ink2)' : 'var(--d-faint)' }}>{actual}</Td>
                      <Td nowrap><Tag tone={VISIT_TONE[st] ?? 'muted'}>{st.replace(/_/g, ' ')}</Tag></Td>
                      <Td><Icon name="chevronRight" size={16} style={{ color: 'var(--d-faint)' }} /></Td>
                    </Row>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
      </Panel>
      {total > VISITS_PER_PAGE && <Pager page={page} perPage={VISITS_PER_PAGE} total={total} onPage={setPage} />}
    </div>
  );
}

/* ------------------------------- Notes tab -------------------------------- */
// A date-grouped timeline (Today / Yesterday / date) with search + carer filter,
// so a manager scans "what happened when" instead of reading a flat dump.
function noteDay(iso) {
  const d = new Date(iso);
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function NotesTab({ notes, loading, query, setQuery, carer, setCarer, carers, from, setFrom, to, setTo }) {
  const groups = useMemo(() => {
    const g = new Map();
    (notes ?? []).forEach((n) => {
      const k = noteDay(n.visit_scheduled_start ?? n.created_at);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(n);
    });
    return [...g.entries()];
  }, [notes]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={s('display:flex;flex-direction:column;gap:14px')}>
      <Panel style={{ padding: '14px 16px' }}>
        <FilterBar>
          <DateField label="From" value={from} onChange={setFrom} max={to || today} />
          <DateField label="To" value={to} onChange={setTo} min={from} max={today} />
          <SelectField label="Carer" value={carer} onChange={setCarer} options={carers.map((c) => ({ id: c.id, label: c.name }))} allLabel="All carers" minWidth={160} />
          <div style={s('flex:1;min-width:200px')}><SearchBox value={query} onChange={setQuery} placeholder="Search notes" /></div>
        </FilterBar>
      </Panel>
      {loading ? <Panel><Muted>Loading…</Muted></Panel>
        : (notes ?? []).length === 0 ? <Panel><Muted>No notes match.</Muted></Panel>
        : groups.map(([day, rows]) => (
          <div key={day} style={s('display:flex;flex-direction:column;gap:8px')}>
            <div style={s('display:flex;align-items:center;gap:10px;padding:0 2px')}>
              <span style={s('font-size:11.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{day}</span>
              <span style={s('flex:1;height:1px;background:var(--d-border)')} />
              <span style={s('font-size:11px;font-weight:600;color:var(--d-faint)')}>{rows.length} note{rows.length === 1 ? '' : 's'}</span>
            </div>
            {rows.map((n) => (
              <div key={n.id} style={{ ...s('background:var(--d-card);border-radius:14px;padding:13px 15px;display:flex;gap:11px'), border: '1px solid var(--d-card-line, var(--d-border))', boxShadow: 'var(--d-shadow-card, none)' }}>
                <Avatar initials={(n.employee_name ?? n.author_name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')} size="sm" />
                <div style={s('flex:1;min-width:0')}>
                  <div style={s('font-size:13px;font-weight:500;color:var(--d-ink);line-height:1.55')}>{n.body}</div>
                  <div style={s('display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:var(--d-muted);margin-top:6px')}>
                    <span style={s('font-weight:700;color:var(--d-ink2)')}>{n.employee_name ?? n.author_name ?? 'Unknown'}</span><span>·</span>
                    <span>{fmtNoteDate(n.visit_scheduled_start ?? n.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

const inp = { ...s('height:40px;border-radius:11px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13.5px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };
function L({ label, children }) {
  return <label style={s('display:flex;flex-direction:column;gap:6px')}><span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>{label}</span>{children}</label>;
}
function Muted({ children }) { return <div style={s('padding:30px 8px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>{children}</div>; }

// Inline care-plan editor for the client Edit section: add / edit / remove the
// client's care tasks. Each change saves immediately (each item is its own
// nested resource), so there's no separate "save the plan" step.
function CarePlanEditor({ clientId }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => { listCarePlanItems(clientId).then(setItems).catch(() => setItems([])); }, [clientId]);
  useEffect(() => { reload(); }, [reload]);

  async function add() {
    if (!newLabel.trim()) { toast.error('Give the care task a short label.'); return; }
    setBusy(true);
    try { await createCarePlanItem(clientId, { label: newLabel.trim(), detail: newDetail.trim() || null }); setNewLabel(''); setNewDetail(''); reload(); toast.success('Care task added'); }
    catch (e) { toast.error(e.message || 'Could not add'); } finally { setBusy(false); }
  }
  function startEdit(it) { setEditId(it.id); setEditLabel(it.label); setEditDetail(it.detail ?? ''); }
  async function saveEdit() {
    if (!editLabel.trim()) { toast.error('Give the care task a short label.'); return; }
    setBusy(true);
    try { await updateCarePlanItem(clientId, editId, { label: editLabel.trim(), detail: editDetail.trim() || null }); setEditId(null); reload(); toast.success('Care task updated'); }
    catch (e) { toast.error(e.message || 'Could not update'); } finally { setBusy(false); }
  }
  async function remove(id) {
    setBusy(true);
    try { await deleteCarePlanItem(clientId, id); reload(); toast.info('Care task removed'); }
    catch (e) { toast.error(e.message || 'Could not remove'); } finally { setBusy(false); }
  }

  const small = { ...inp, height: 36, fontSize: 13 };

  return (
    <div style={s('display:flex;flex-direction:column;gap:8px')}>
      {items == null ? <span style={s('font-size:12px;color:var(--d-muted)')}>Loading…</span>
        : items.length === 0 ? <span style={s('font-size:12px;color:var(--d-muted)')}>No care tasks yet — add the first below.</span>
        : items.map((it) => (
          <div key={it.id} style={s('background:var(--d-panel);border-radius:11px;padding:9px 11px')}>
            {editId === it.id ? (
              <div style={s('display:flex;flex-direction:column;gap:7px')}>
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Care task" style={small} />
                <input value={editDetail} onChange={(e) => setEditDetail(e.target.value)} placeholder="Detail (optional)" style={small} />
                <div style={s('display:flex;gap:6px')}>
                  <Button size="sm" variant="primary" onClick={busy ? undefined : saveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div style={s('display:flex;align-items:flex-start;gap:10px')}>
                <div style={s('flex:1;min-width:0')}>
                  <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{it.label}</div>
                  {it.detail && <div style={s('font-size:12px;font-weight:500;color:var(--d-ink2);margin-top:2px;line-height:1.5')}>{it.detail}</div>}
                </div>
                <button type="button" onClick={() => startEdit(it)} title="Edit" style={{ ...s('background:transparent;border:0;cursor:pointer;color:var(--d-muted);padding:2px'), fontFamily: 'inherit' }}><Icon name="edit" size={14} /></button>
                <button type="button" onClick={() => remove(it.id)} title="Remove" style={{ ...s('background:transparent;border:0;cursor:pointer;color:var(--d-muted);padding:2px'), fontFamily: 'inherit' }}><Icon name="close" size={15} /></button>
              </div>
            )}
          </div>
        ))}
      {/* Add row */}
      <div style={s('display:flex;flex-direction:column;gap:7px;margin-top:2px')}>
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Add a care task (e.g. Prompt morning medication)" style={small} />
        <input value={newDetail} onChange={(e) => setNewDetail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Detail (optional)" style={small} />
        <div><Button size="sm" icon="plus" onClick={busy ? undefined : add}>Add task</Button></div>
      </div>
    </div>
  );
}
