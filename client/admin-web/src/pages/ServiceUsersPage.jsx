import { useEffect, useMemo, useState } from 'react';
import { listServiceUsers, createServiceUser, updateServiceUser, listCarePlanItems } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, addressOf } from '../api/format.js';
import { Panel, PanelTitle, StatCard, Tag, Avatar, Button, SegTabs } from '../ds/console.jsx';

const EMPTY = {
  first_name: '', last_name: '', reference: '', phone: '',
  address_line1: '', address_line2: '', city: '', postcode: '',
  lat: '', lng: '', geofence_radius_m: 150, geofence_mode: 'block', access_notes: '',
};
const GEOFENCE_HELP = {
  block: 'Clocking in is refused outside the radius. Use where attendance must be exact.',
  warn: 'Clocking in is allowed but flagged for the office to review.',
  off: 'Location is recorded but never checked against the address.',
};
const MODE_LABEL = { block: 'Block', warn: 'Warn', off: 'Record only' };
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
const inputStyle = { ...s('height:46px;border-radius:16px;background:var(--d-field);padding:0 16px;font-size:14px;font-weight:500;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%'), fontFamily: 'inherit', border: '1.5px solid transparent' };

export default function ServiceUsersPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [profileFor, setProfileFor] = useState(null);
  const [carePlan, setCarePlan] = useState([]);
  const [carePlanLoading, setCarePlanLoading] = useState(false);

  async function load() { setRows(await listServiceUsers()); }
  async function openProfile(r) {
    setProfileFor(r); setCarePlanLoading(true);
    try { setCarePlan(await listCarePlanItems(r.id)); } catch { setCarePlan([]); } finally { setCarePlanLoading(false); }
  }
  useEffect(() => { let active = true; load().finally(() => active && setLoading(false)); return () => { active = false; }; }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (modeFilter === 'all' ? true : (r.geofence_mode ?? 'block') === modeFilter))
      .filter((r) => (q ? `${r.full_name} ${r.reference ?? ''} ${r.postcode ?? ''}`.toLowerCase().includes(q) : true));
  }, [rows, query, modeFilter]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  function openCreate() { setForm(EMPTY); setEditing(null); setCreating(true); }
  function openEdit(r) { setEditing(r); setForm({ ...EMPTY, ...r, lat: r.lat ?? '', lng: r.lng ?? '' }); }
  function closeModal() { setCreating(false); setEditing(null); }
  async function save() {
    setSaving(true);
    try {
      const payload = { ...form, lat: form.lat === '' ? null : Number(form.lat), lng: form.lng === '' ? null : Number(form.lng), geofence_radius_m: Number(form.geofence_radius_m) || 150 };
      if (editing) { await updateServiceUser(editing.id, payload); toast.success('Record updated'); }
      else { await createServiceUser(payload); toast.success('Person added'); }
      await load(); closeModal(); setForm(EMPTY);
    } catch (err) { toast.error(err.message || 'Could not save'); } finally { setSaving(false); }
  }

  if (loading) return <Spinner fullscreen />;

  const missingCoords = rows.filter((r) => r.lat == null).length;
  const totalVisits = rows.reduce((a, r) => a + (r.visits_per_week ?? 0), 0);
  const adhVals = rows.map((r) => r.adherence).filter((v) => v != null);
  const avgAdh = adhVals.length ? Math.round(adhVals.reduce((a, b) => a + b, 0) / adhVals.length) : null;
  const modeTabs = [
    { key: 'all', label: 'All', icon: 'user', count: rows.length },
    { key: 'block', label: 'Block', icon: 'shield', count: rows.filter((r) => (r.geofence_mode ?? 'block') === 'block').length },
    { key: 'warn', label: 'Warn', icon: 'alert', count: rows.filter((r) => r.geofence_mode === 'warn').length },
    { key: 'off', label: 'Record only', icon: 'pin', count: rows.filter((r) => r.geofence_mode === 'off').length },
  ];
  const siteExceptions = rows.filter((r) => (r.geofence_mode ?? 'block') !== 'warn' || r.lat == null);

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
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
        <div style={s('height:46px;flex:1;min-width:220px;background:var(--d-field);border-radius:23px;display:flex;align-items:center;gap:10px;padding:0 18px')}>
          <Icon name="search" size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, reference or postcode" style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
        </div>
        <div style={s('flex:1')} />
        {canManage && <Button variant="primary" icon="plus" onClick={openCreate}>Add a person</Button>}
      </div>

      {/* Geofence-mode filter + card grid */}
      <div style={s('display:flex;flex-direction:column')}>
        <SegTabs tabs={modeTabs} active={modeFilter} onSelect={setModeFilter} />
        <div style={s('margin-top:12px')}>
          {filtered.length === 0 ? (
            <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>Nobody matches that search.</div>
          ) : (
            <div style={s('display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px')}>
              {filtered.map((r) => {
                const noCoords = r.lat == null;
                const mode = r.geofence_mode ?? 'block';
                return (
                  <div key={r.id} style={s('background:var(--d-card);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:14px')}>
                    <div style={s('display:flex;align-items:flex-start;gap:12px')}>
                      <Avatar initials={`${r.first_name?.[0] ?? ''}${r.last_name?.[0] ?? ''}`} />
                      <div style={s('flex:1;min-width:0')}>
                        <div onClick={() => openProfile(r)} className="hv" style={{ ...s('font-size:16px;font-weight:700;color:var(--d-ink);cursor:pointer;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:6px'), '--hbg': 'transparent' }}>{fullName(r)}</div>
                        <div style={s('display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;color:var(--d-muted);margin-top:2px')}><Icon name="pin" size={12} /><span style={s('white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{addressOf(r)}</span></div>
                        <div style={s('display:flex;gap:6px;flex-wrap:wrap;margin-top:8px')}>
                          <Tag tone="primary">{r.reference ?? 'No ref'}</Tag>
                          {noCoords && <Tag tone="warning">No coordinates</Tag>}
                        </div>
                      </div>
                    </div>

                    <div style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:8px')}>
                      {[['Visits / wk', r.visits_per_week ?? 0], ['Adherence', r.adherence == null ? '—' : `${r.adherence}%`], ['Radius', `${r.geofence_radius_m}m`]].map(([l, v]) => (
                        <div key={l} style={s('background:var(--d-panel);border-radius:12px;padding:9px;text-align:center')}>
                          <div style={s('font-size:9.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{l}</div>
                          <div className="d-num" style={s('font-size:14px;font-weight:700;color:var(--d-ink);margin-top:2px')}>{v}</div>
                        </div>
                      ))}
                    </div>

                    <div style={s('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:500;color:var(--d-muted)')}><Icon name="shield" size={13} /> Geofence {r.geofence_radius_m}m · {MODE_LABEL[mode]}</div>

                    <div style={s('display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--d-border);padding-top:12px')}>
                      <div style={s('display:flex;align-items:center;gap:8px;min-width:0')}>
                        <div style={s('display:flex')}>
                          {(r.carers ?? []).slice(0, 3).map((name, i) => (
                            <div key={name} style={{ ...s('width:26px;height:26px;border-radius:50%;background:var(--d-sage);display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:var(--d-ink2);border:2px solid var(--d-card)'), marginLeft: i ? -8 : 0 }}>{inits(name)}</div>
                          ))}
                        </div>
                        <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{(r.carers ?? []).length} carer{(r.carers ?? []).length === 1 ? '' : 's'}</span>
                      </div>
                      <Button size="sm" onClick={() => openProfile(r)}>Open</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Site-level clocking exceptions */}
      {siteExceptions.length > 0 && (
        <Panel>
          <PanelTitle hint="Where clocking rules differ from the warn default, or coordinates are missing">Site-level clocking exceptions</PanelTitle>
          <div style={s('display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px')}>
            {siteExceptions.map((r) => (
              <div key={r.id} style={s('border:1px solid var(--d-border);border-radius:14px;padding:12px 14px')}>
                <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{fullName(r)}</div>
                <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{r.lat == null ? 'No coordinates' : `${MODE_LABEL[r.geofence_mode ?? 'block']} · ${r.geofence_radius_m}m`}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Add / edit modal */}
      {(creating || editing) && (
        <div onClick={closeModal} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(ev) => ev.stopPropagation()} style={s('width:100%;max-width:560px;max-height:90vh;background:var(--d-card);border-radius:28px;display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 8px;display:flex;align-items:center')}>
              <div style={s('font-size:19px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>{editing ? `Edit ${editing.first_name}` : 'Add a person'}</div>
              <div style={s('flex:1')} />
              <div onClick={closeModal} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:8px 24px 4px;display:flex;flex-direction:column;gap:16px')}>
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
              <div style={s('display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px')}>
                <Field label="Latitude"><input style={inputStyle} value={form.lat} onChange={set('lat')} placeholder="53.4808" /></Field>
                <Field label="Longitude"><input style={inputStyle} value={form.lng} onChange={set('lng')} placeholder="-2.2426" /></Field>
                <Field label="Radius, m"><input style={inputStyle} type="number" value={form.geofence_radius_m} onChange={set('geofence_radius_m')} /></Field>
              </div>
              <Field label="Checking mode" hint={GEOFENCE_HELP[form.geofence_mode]}>
                <select style={inputStyle} value={form.geofence_mode} onChange={set('geofence_mode')}>
                  <option value="block">Block, refuse clock in outside the radius</option>
                  <option value="warn">Warn, allow but flag it</option>
                  <option value="off">Off, record location without checking</option>
                </select>
              </Field>
              <Field label="Access notes for carers">
                <textarea rows={3} value={form.access_notes} onChange={set('access_notes')} placeholder="Key safe code, parking, who is usually in." style={{ ...inputStyle, height: 'auto', padding: '12px 16px', resize: 'vertical', lineHeight: 1.5 }} />
              </Field>
            </div>
            <div style={s('padding:16px 24px 22px;display:flex;justify-content:flex-end;gap:10px')}>
              <Button onClick={closeModal}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={saving ? undefined : save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add person'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile drawer */}
      {profileFor && (
        <div onClick={() => setProfileFor(null)} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.42);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(ev) => ev.stopPropagation()} style={s('width:100%;max-width:460px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 18px;border-bottom:1px solid var(--d-border);display:flex;align-items:flex-start;gap:14px')}>
              <Avatar initials={`${profileFor.first_name?.[0] ?? ''}${profileFor.last_name?.[0] ?? ''}`} />
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:18px;font-weight:700;color:var(--d-ink)')}>{fullName(profileFor)}</div>
                <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{profileFor.reference ?? 'No reference'}</div>
              </div>
              <div onClick={() => setProfileFor(null)} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:18px')}>
              <div style={s('display:grid;grid-template-columns:repeat(3,1fr);gap:8px')}>
                {[['Visits / wk', profileFor.visits_per_week ?? 0], ['Adherence', profileFor.adherence == null ? '—' : `${profileFor.adherence}%`], ['Carers', (profileFor.carers ?? []).length]].map(([l, v]) => (
                  <div key={l} style={s('background:var(--d-panel);border-radius:12px;padding:11px;text-align:center')}>
                    <div style={s('font-size:9.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{l}</div>
                    <div className="d-num" style={s('font-size:15px;font-weight:700;color:var(--d-ink);margin-top:3px')}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={s('display:flex;flex-direction:column;gap:6px')}>
                <div style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Address</div>
                <div style={s('font-size:13.5px;font-weight:500;color:var(--d-ink);line-height:1.5')}>{addressOf(profileFor)}</div>
              </div>
              <div style={s('display:flex;flex-direction:column;gap:8px')}>
                <div style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Clocking rules</div>
                <div style={s('background:var(--d-panel);border-radius:16px;padding:14px 16px')}>
                  <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{profileFor.lat == null ? 'No coordinates' : `${profileFor.geofence_radius_m}m · ${MODE_LABEL[profileFor.geofence_mode ?? 'block']}`}</div>
                  <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.5;margin-top:6px')}>{GEOFENCE_HELP[profileFor.geofence_mode ?? 'block']}</div>
                </div>
              </div>
              {profileFor.access_notes && (
                <div style={s('display:flex;flex-direction:column;gap:8px')}>
                  <div style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Access notes</div>
                  <div style={s('background:var(--d-note-bg);border-radius:16px;padding:14px 16px;font-size:13px;font-weight:500;color:var(--d-note-ink);line-height:1.55')}>{profileFor.access_notes}</div>
                </div>
              )}
              <div style={s('display:flex;flex-direction:column;gap:8px')}>
                <div style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Care plan</div>
                {carePlanLoading ? <div style={s('font-size:13px;color:var(--d-muted)')}>Loading…</div>
                  : carePlan.length === 0 ? <div style={s('font-size:13px;color:var(--d-muted)')}>No care plan items recorded.</div>
                  : carePlan.map((c) => (
                    <div key={c.id} style={s('background:var(--d-panel);border-radius:14px;padding:12px 14px')}>
                      <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>{c.label}</div>
                      {c.detail && <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.5;margin-top:3px')}>{c.detail}</div>}
                    </div>
                  ))}
              </div>
            </div>
            {canManage && <div style={s('padding:16px 22px;border-top:1px solid var(--d-border);display:flex;justify-content:flex-end')}><Button variant="primary" icon="edit" onClick={() => { const r = profileFor; setProfileFor(null); openEdit(r); }}>Edit details</Button></div>}
          </div>
        </div>
      )}
    </div>
  );
}
