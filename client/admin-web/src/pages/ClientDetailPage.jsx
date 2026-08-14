import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { fullName, addressOf } from '../api/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Panel, PanelTitle, Tag, Avatar, Button } from '../ds/console.jsx';
import { getServiceUser, updateServiceUser, listCarePlanItems, createCarePlanItem, deleteCarePlanItem, listServiceUserNotes } from '../api/index.js';

const GEOFENCE_HELP = {
  block: 'Clock-in is blocked outside the fence.',
  warn: 'Carer is warned but can still clock in.',
  off: 'Location is recorded only, never enforced.',
};
const MODE_LABEL = { block: 'Block', warn: 'Warn', off: 'Record only' };
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'careplan', label: 'Care plan' },
  { key: 'notes', label: 'Visit notes' },
];
const EMPTY = {
  first_name: '', last_name: '', reference: '', phone: '',
  address_line1: '', address_line2: '', city: '', postcode: '',
  lat: '', lng: '', geofence_radius_m: 150, geofence_mode: 'block', access_notes: '',
};
const fmtNoteDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { canManage } = useAuth();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const [carePlan, setCarePlan] = useState(null);
  const [notes, setNotes] = useState(null);
  const [noteQuery, setNoteQuery] = useState('');
  const [noteCarer, setNoteCarer] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setClient(await getServiceUser(id)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'careplan' || carePlan) return;
    listCarePlanItems(id).then(setCarePlan).catch(() => setCarePlan([]));
  }, [tab, id, carePlan]);

  useEffect(() => {
    if (tab !== 'notes') return undefined;
    let active = true;
    setNotesLoading(true);
    const filters = {};
    if (noteQuery.trim()) filters.q = noteQuery.trim();
    if (noteCarer) filters.employee_id = noteCarer;
    listServiceUserNotes(id, filters)
      .then((r) => active && setNotes(r.notes ?? []))
      .catch(() => active && setNotes([]))
      .finally(() => active && setNotesLoading(false));
    return () => { active = false; };
  }, [tab, id, noteQuery, noteCarer]);

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
    const payload = { ...form, lat: form.lat === '' ? null : Number(form.lat), lng: form.lng === '' ? null : Number(form.lng), geofence_radius_m: Number(form.geofence_radius_m) };
    try { await updateServiceUser(client.id, payload); toast.success('Record updated'); setEditing(false); await load(); }
    catch (e) { toast.error(e.message || 'Could not save'); } finally { setSaving(false); }
  }
  async function toggleActive() {
    try { await updateServiceUser(client.id, { active: !client.active }); toast.success(client.active ? 'Archived' : 'Reactivated'); await load(); }
    catch (e) { toast.error(e.message || 'Could not update'); }
  }

  async function addCarePlanItem(label, detail, category) {
    if (!label.trim()) { toast.error('Give the care task a short label.'); return false; }
    try {
      await createCarePlanItem(client.id, { label: label.trim(), detail: detail.trim() || null, category: category || 'general' });
      setCarePlan(await listCarePlanItems(client.id));
      toast.success('Care plan item added');
      return true;
    } catch (e) { toast.error(e.message || 'Could not add the item'); return false; }
  }
  async function removeCarePlanItem(itemId) {
    try { await deleteCarePlanItem(client.id, itemId); setCarePlan(await listCarePlanItems(client.id)); toast.info('Item removed'); }
    catch (e) { toast.error(e.message || 'Could not remove the item'); }
  }

  const inits = `${client.first_name?.[0] ?? ''}${client.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div><Button size="sm" icon="chevronLeft" onClick={() => navigate('/clients')}>Back to clients</Button></div>

      <Panel style={{ padding: '22px 24px' }}>
        <div style={s('display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap')}>
          <Avatar initials={inits} size={64} />
          <div style={s('flex:1;min-width:0')}>
            <div style={s('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
              <div style={s('font-size:22px;font-weight:700;color:var(--d-ink)')}>{fullName(client)}</div>
              <Tag tone={client.active ? 'success' : 'muted'}>{client.active ? 'Active' : 'Archived'}</Tag>
            </div>
            <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);margin-top:4px')}>{client.reference ?? 'No reference'}{client.phone ? ` · ${client.phone}` : ''}</div>
            <div style={s('font-size:13.5px;font-weight:500;color:var(--d-ink);margin-top:8px;display:flex;align-items:center;gap:6px')}><Icon name="pin" size={14} />{addressOf(client) || 'No address'}</div>
            <div style={s('display:flex;gap:16px;margin-top:12px;flex-wrap:wrap')}>
              {[['Visits / week', client.visits_per_week ?? 0],
                ['Adherence', client.adherence == null ? '—' : `${client.adherence}%`],
                ['Regular carers', (client.carers ?? []).length]].map(([l, v]) => (
                <div key={l}><div className="d-num" style={s('font-size:17px;font-weight:700;color:var(--d-ink)')}>{v}</div><div style={s('font-size:11px;font-weight:600;color:var(--d-muted)')}>{l}</div></div>
              ))}
            </div>
          </div>
          {canManage && (
            <div style={s('display:flex;gap:8px;flex:none')}>
              <Button size="sm" icon="edit" onClick={openEdit}>Edit</Button>
              <Button size="sm" variant={client.active ? 'danger' : 'ghost'} onClick={toggleActive}>{client.active ? 'Archive' : 'Reactivate'}</Button>
            </div>
          )}
        </div>

        {editing && (
          <div style={s('margin-top:18px;padding-top:18px;border-top:1px solid var(--d-border);display:flex;flex-direction:column;gap:12px')}>
            <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
              <L label="First name"><input style={inp} value={form.first_name} onChange={setField('first_name')} /></L>
              <L label="Last name"><input style={inp} value={form.last_name} onChange={setField('last_name')} /></L>
              <L label="Reference"><input style={inp} value={form.reference} onChange={setField('reference')} /></L>
              <L label="Phone"><input style={inp} value={form.phone} onChange={setField('phone')} /></L>
              <L label="Address line 1"><input style={inp} value={form.address_line1} onChange={setField('address_line1')} /></L>
              <L label="City"><input style={inp} value={form.city} onChange={setField('city')} /></L>
              <L label="Postcode"><input style={inp} value={form.postcode} onChange={setField('postcode')} /></L>
              <L label="Latitude"><input style={inp} value={form.lat} onChange={setField('lat')} /></L>
              <L label="Longitude"><input style={inp} value={form.lng} onChange={setField('lng')} /></L>
              <L label="Fence radius (m)"><input style={inp} type="number" value={form.geofence_radius_m} onChange={setField('geofence_radius_m')} /></L>
              <L label="Geofence mode">
                <select style={inp} value={form.geofence_mode} onChange={setField('geofence_mode')}>
                  <option value="block">Block</option><option value="warn">Warn</option><option value="off">Record only</option>
                </select>
              </L>
            </div>
            <L label="Access notes for carers"><textarea rows={2} style={{ ...inp, height: 'auto', padding: '10px 13px' }} value={form.access_notes} onChange={setField('access_notes')} /></L>
            <div style={s('display:flex;gap:8px')}>
              <Button variant="primary" onClick={saving ? undefined : save}>{saving ? 'Saving…' : 'Save'}</Button>
              <Button onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Panel>

      <div style={s('display:flex;gap:4px;flex-wrap:wrap')}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ ...s('border:0;border-radius:10px;padding:9px 15px;font-size:13px;font-weight:700;cursor:pointer'), background: tab === t.key ? 'var(--d-pill)' : 'var(--d-card)', color: tab === t.key ? 'var(--d-pill-ink)' : 'var(--d-ink2)', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Panel style={{ padding: '18px 20px' }}>
          <div style={s('display:flex;flex-direction:column;gap:16px')}>
            <div>
              <PanelTitle>Clocking rules</PanelTitle>
              <div style={s('background:var(--d-panel);border-radius:14px;padding:14px 16px;margin-top:6px')}>
                <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>{client.lat == null ? 'No coordinates set' : `${client.geofence_radius_m}m · ${MODE_LABEL[client.geofence_mode ?? 'block']}`}</div>
                <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.5;margin-top:6px')}>{GEOFENCE_HELP[client.geofence_mode ?? 'block']}</div>
              </div>
            </div>
            {client.access_notes && (
              <div>
                <PanelTitle>Access notes</PanelTitle>
                <div style={s('background:var(--d-note-bg);border-radius:14px;padding:14px 16px;font-size:13px;font-weight:500;color:var(--d-note-ink);line-height:1.55;margin-top:6px')}>{client.access_notes}</div>
              </div>
            )}
          </div>
        </Panel>
      )}

      {tab === 'careplan' && (
        <Panel style={{ padding: '18px 20px' }}>
          {canManage && <CarePlanAdd onAdd={addCarePlanItem} />}
          {carePlan == null ? <Muted>Loading…</Muted>
            : carePlan.length === 0 ? <Muted>No care plan items yet.{canManage ? ' Add the first task above.' : ''}</Muted>
            : carePlan.map((c) => (
              <div key={c.id} style={s('background:var(--d-panel);border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px')}>
                <div style={s('flex:1;min-width:0')}>
                  <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>{c.label}</div>
                  {c.detail && <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.5;margin-top:3px')}>{c.detail}</div>}
                </div>
                {canManage && <button type="button" onClick={() => removeCarePlanItem(c.id)} title="Remove" style={{ ...s('background:transparent;border:0;cursor:pointer;color:var(--d-muted);padding:2px'), fontFamily: 'inherit' }}><Icon name="close" size={15} /></button>}
              </div>
            ))}
        </Panel>
      )}

      {tab === 'notes' && (
        <Panel style={{ padding: '16px 20px' }}>
          <div style={s('display:flex;gap:10px;margin-bottom:14px')}>
            <div style={s('flex:1;display:flex;align-items:center;gap:8px;background:var(--d-panel);border-radius:12px;padding:0 12px')}>
              <Icon name="search" size={15} />
              <input value={noteQuery} onChange={(e) => setNoteQuery(e.target.value)} placeholder="Search notes"
                style={s('flex:1;border:none;background:transparent;outline:none;padding:10px 0;font-size:13px;font-weight:500;color:var(--d-ink);font-family:inherit')} />
            </div>
            <select value={noteCarer} onChange={(e) => setNoteCarer(e.target.value)}
              style={s('background:var(--d-panel);border:none;border-radius:12px;padding:0 12px;font-size:13px;font-weight:600;color:var(--d-ink);font-family:inherit;cursor:pointer')}>
              <option value="">All carers</option>
              {noteCarers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {notesLoading ? <Muted>Loading…</Muted>
            : (notes ?? []).length === 0 ? <Muted>No notes match.</Muted>
            : notes.map((n) => (
              <div key={n.id} style={s('background:var(--d-panel);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;margin-bottom:8px')}>
                <div style={s('font-size:13.5px;font-weight:500;color:var(--d-ink);line-height:1.55')}>{n.body}</div>
                <div style={s('display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:600;color:var(--d-muted)')}>
                  <Icon name="user" size={12} /><span>{n.employee_name ?? n.author_name ?? 'Unknown'}</span><span>·</span>
                  <span>{fmtNoteDate(n.visit_scheduled_start ?? n.created_at)}</span>
                </div>
              </div>
            ))}
        </Panel>
      )}
    </div>
  );
}

const inp = { ...s('height:40px;border-radius:11px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13.5px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };
function L({ label, children }) {
  return <label style={s('display:flex;flex-direction:column;gap:6px')}><span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>{label}</span>{children}</label>;
}
function Muted({ children }) { return <div style={s('padding:30px 8px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>{children}</div>; }

// Inline add-a-care-plan-item form used during onboarding and later editing.
function CarePlanAdd({ onAdd }) {
  const [label, setLabel] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const ok = await onAdd(label, detail, 'general');
    if (ok) { setLabel(''); setDetail(''); }
    setBusy(false);
  }
  return (
    <div style={s('background:var(--d-panel);border-radius:14px;padding:12px 14px;margin-bottom:14px;display:flex;flex-direction:column;gap:8px')}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Care task (e.g. Prompt morning medication)" style={inp} />
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="Detail (optional)" style={{ ...inp, height: 'auto', padding: '10px 13px' }} />
      <div><Button variant="primary" icon="plus" onClick={busy ? undefined : submit}>{busy ? 'Adding…' : 'Add care task'}</Button></div>
    </div>
  );
}
