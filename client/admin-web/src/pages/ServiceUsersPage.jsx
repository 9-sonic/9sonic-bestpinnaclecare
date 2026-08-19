import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listServiceUsers, createServiceUser } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import Modal from '../components/common/Modal.jsx';
import InfoHint from '../components/common/InfoHint.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, addressOf } from '../api/format.js';
import { Panel, PanelTitle, StatCard, Tag, Avatar, Button, Pager, fieldStyle, SearchBox } from '../ds/console.jsx';

const EMPTY = {
  first_name: '', last_name: '', reference: '', phone: '',
  address_line1: '', address_line2: '', city: '', postcode: '',
  lat: '', lng: '', access_notes: '',
};
const inits = (name) => (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function Field({ label, hint, children, full }) {
  return (
    <label style={{ ...s('display:flex;flex-direction:column;gap:7px'), gridColumn: full ? '1 / -1' : undefined }}>
      <span style={s('font-size:12.5px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
      {children}
      {hint && <span style={s('font-size:12px;font-weight:500;color:var(--d-muted);line-height:1.45')}>{hint}</span>}
    </label>
  );
}
const inputStyle = fieldStyle();

export default function ServiceUsersPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() { setRows(await listServiceUsers()); }
  useEffect(() => { let active = true; load().finally(() => active && setLoading(false)); return () => { active = false; }; }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (q ? `${r.full_name} ${r.reference ?? ''} ${r.postcode ?? ''}`.toLowerCase().includes(q) : true));
  }, [rows, query]);

  // Client-side pagination over the filtered clients so search spans everyone.
  const PER_PAGE = 18;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [query]);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Add only — editing a client lives on their detail page (/clients/:id).
  function openCreate() { setForm(EMPTY); setCreating(true); }
  function closeModal() { setCreating(false); }
  async function save() {
    setSaving(true);
    try {
      const payload = { ...form, lat: form.lat === '' ? null : Number(form.lat), lng: form.lng === '' ? null : Number(form.lng) };
      await createServiceUser(payload);
      toast.success('Person added');
      await load(); closeModal(); setForm(EMPTY);
    } catch (err) { toast.error(err.message || 'Could not save'); } finally { setSaving(false); }
  }

  if (loading) return <Spinner fullscreen />;

  const missingCoords = rows.filter((r) => r.lat == null).length;
  const totalVisits = rows.reduce((a, r) => a + (r.visits_per_week ?? 0), 0);
  const adhVals = rows.map((r) => r.adherence).filter((v) => v != null);
  const avgAdh = adhVals.length ? Math.round(adhVals.reduce((a, b) => a + b, 0) / adhVals.length) : null;
  // A client with no coordinates can't be geofenced — the one real exception now
  // that the fence is always-on at a fixed radius.
  const siteExceptions = rows.filter((r) => r.lat == null);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Stat cards */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        <StatCard label="Active clients" value={rows.filter((r) => r.active !== false).length} hint={`${rows.length} on the books`} tone="primary" icon="users" />
        <StatCard label="Visits per week" value={totalVisits} hint="Generated from care packages" tone="info" icon="calendar" />
        <StatCard label="Clock-in adherence" value={avgAdh == null ? '—' : `${avgAdh}%`} hint="Clocked inside the geofence, 30d" tone="success" icon="shield" />
        <StatCard label="Missing coordinates" value={missingCoords} hint="Geofence cannot be checked" tone="warning" icon="alert" />
      </div>

      {/* Toolbar */}
      <div data-tour="clients-toolbar" style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
        <div style={s('flex:1;min-width:220px')}>
          <SearchBox value={query} onChange={setQuery} placeholder="Search name, reference or postcode" />
        </div>
        <div style={s('flex:1')} />
        {canManage && <span data-tour="clients-add" style={s('display:inline-flex;align-items:center;gap:6px')}><Button variant="primary" icon="plus" onClick={openCreate}>Add a person</Button><InfoHint text="Add a new client with their name and address. The geofence (carers clock in within 150m) is located from the address automatically — you only enter coordinates to correct where the pin lands." /></span>}
      </div>

      {/* Client card grid */}
      <div style={s('display:flex;flex-direction:column')}>
        <div>
          {filtered.length === 0 ? (
            <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>Nobody matches that search.</div>
          ) : (
            <div style={s('display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px')}>
              {paged.map((r) => {
                const noCoords = r.lat == null;
                return (
                  <div key={r.id} style={s('background:var(--d-card);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:14px')}>
                    <div style={s('display:flex;align-items:flex-start;gap:12px')}>
                      <Avatar initials={`${r.first_name?.[0] ?? ''}${r.last_name?.[0] ?? ''}`} />
                      <div style={s('flex:1;min-width:0')}>
                        <div onClick={() => navigate(`/clients/${r.id}`)} className="hv" style={{ ...s('font-size:16px;font-weight:700;color:var(--d-ink);cursor:pointer;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:6px'), '--hbg': 'transparent' }}>{fullName(r)}</div>
                        <div style={s('display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;color:var(--d-muted);margin-top:2px')}><Icon name="pin" size={12} /><span style={s('white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{addressOf(r)}</span></div>
                        <div style={s('display:flex;gap:6px;flex-wrap:wrap;margin-top:8px')}>
                          <Tag tone="primary">{r.reference ?? 'No ref'}</Tag>
                          {noCoords && <Tag tone="warning">No coordinates</Tag>}
                        </div>
                      </div>
                    </div>

                    <div style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:8px')}>
                      {[['Visits / wk', r.visits_per_week ?? 0], ['Adherence', r.adherence == null ? '—' : `${r.adherence}%`], ['Fence', '150m']].map(([l, v]) => (
                        <div key={l} style={s('background:var(--d-panel);border-radius:12px;padding:9px;text-align:center')}>
                          <div style={s('font-size:9.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{l}</div>
                          <div className="d-num" style={s('font-size:14px;font-weight:700;color:var(--d-ink);margin-top:2px')}>{v}</div>
                        </div>
                      ))}
                    </div>

                    <div style={s('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:500;color:var(--d-muted)')}><Icon name="shield" size={13} /> On site only — clock-in within 150 m</div>

                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--d-border);padding-top:12px')}>
                      <div style={s('display:flex;align-items:center;gap:8px;min-width:0')}>
                        <div style={s('display:flex')}>
                          {(r.carers ?? []).slice(0, 3).map((name, i) => (
                            <div key={name} style={{ ...s('width:26px;height:26px;border-radius:50%;background:var(--d-sage);display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:var(--d-ink2);border:2px solid var(--d-card)'), marginLeft: i ? -8 : 0 }}>{inits(name)}</div>
                          ))}
                        </div>
                        <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{(r.carers ?? []).length} carer{(r.carers ?? []).length === 1 ? '' : 's'}</span>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/clients/${r.id}`)}>Open</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pager page={page} perPage={PER_PAGE} total={filtered.length} onPage={setPage} />
        </div>
      </div>

      {/* Site-level clocking exceptions */}
      {siteExceptions.length > 0 && (
        <Panel>
          <PanelTitle hint="Clients with no coordinates can't be geofenced — add an address so clock-in can be enforced">Missing location</PanelTitle>
          <div style={s('display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px')}>
            {siteExceptions.map((r) => (
              <div key={r.id} style={s('border:1px solid var(--d-border);border-radius:14px;padding:12px 14px')}>
                <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{fullName(r)}</div>
                <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>No coordinates</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Add-a-person modal (editing lives on the client detail page) */}
      {creating && (
        <Modal
          onClose={closeModal}
          title="Add a person"
          maxWidth={560}
          footer={(
            <div style={s('display:flex;justify-content:flex-end;gap:10px')}>
              <span data-tour="clients-modal-cancel"><Button onClick={closeModal}>Cancel</Button></span>
              <Button variant="primary" icon="check" onClick={saving ? undefined : save}>{saving ? 'Saving…' : 'Add person'}</Button>
            </div>
          )}
        >
          <div data-tour="clients-modal" style={s('flex:1;overflow-y:auto;padding:8px 24px 4px;display:flex;flex-direction:column;gap:16px')}>
            <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:14px')}>
              <Field label="First name"><input style={inputStyle} value={form.first_name} onChange={set('first_name')} /></Field>
              <Field label="Last name"><input style={inputStyle} value={form.last_name} onChange={set('last_name')} /></Field>
              <Field label="Reference"><input style={inputStyle} value={form.reference} onChange={set('reference')} /></Field>
              <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={set('phone')} /></Field>
              <Field label="Address" full><input style={inputStyle} value={form.address_line1} onChange={set('address_line1')} placeholder="Line 1" /></Field>
              <Field label="Town or city"><input style={inputStyle} value={form.city} onChange={set('city')} /></Field>
              <Field label="Postcode"><input style={inputStyle} value={form.postcode} onChange={set('postcode')} /></Field>
            </div>
            <div style={s('height:1px;background:var(--d-panel2);margin:2px 0')} />
            <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>Geofence</div>
            <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);line-height:1.45')}>Carers clock in at this address, within 150 m. The coordinates are found from the address automatically — leave these blank unless you need to correct where the pin lands.</div>
            <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:14px')}>
              <Field label="Latitude (optional)"><input style={inputStyle} value={form.lat} onChange={set('lat')} placeholder="Auto from address" /></Field>
              <Field label="Longitude (optional)"><input style={inputStyle} value={form.lng} onChange={set('lng')} placeholder="Auto from address" /></Field>
            </div>
            <Field label="Access notes for carers">
              <textarea rows={3} value={form.access_notes} onChange={set('access_notes')} placeholder="Key safe code, parking, who is usually in." style={{ ...inputStyle, height: 'auto', padding: '12px 16px', resize: 'vertical', lineHeight: 1.5 }} />
            </Field>
          </div>
        </Modal>
      )}

    </div>
  );
}
