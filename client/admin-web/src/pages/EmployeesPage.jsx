import { useEffect, useMemo, useState } from 'react';
import { listEmployees, inviteEmployee, updateEmployee, getEmployeeAvailability, uploadEmployeeAvatar, removeEmployeeAvatar } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName } from '../api/format.js';
import { StatCard, Tag, Avatar, Button, TableWrap, Th, Td, Row, SegTabs } from '../ds/console.jsx';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', role: 'carer', employee_reference: '' };
const METHOD = { gps: 'App (GPS)', pin: 'PIN tablet', manual_admin: 'Manual', manual: 'Manual' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Field({ label, error, hint, children, full }) {
  return (
    <label style={{ ...s('display:flex;flex-direction:column;gap:7px'), gridColumn: full ? '1 / -1' : undefined }}>
      <span style={s('font-size:12.5px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
      {children}
      {error && <span style={s('font-size:12px;font-weight:600;color:var(--d-danger-ink)')}>{error}</span>}
      {hint && !error && <span style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>{hint}</span>}
    </label>
  );
}
const input = (error, disabled) => ({ ...s('height:46px;border-radius:16px;background:var(--d-field);padding:0 16px;font-size:14px;font-weight:500;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%'), fontFamily: 'inherit', border: `1.5px solid ${error ? 'var(--d-danger-ink)' : 'transparent'}`, opacity: disabled ? 0.6 : 1 });

function Meter({ value }) {
  if (value == null) return <span style={s('font-size:12px;font-weight:500;color:var(--d-faint)')}>—</span>;
  const bar = value >= 95 ? 'var(--d-ok-ink)' : value >= 85 ? 'var(--d-warn-dot)' : 'var(--d-danger-dot)';
  return (
    <div style={s('min-width:104px')}>
      <div style={s('display:flex;justify-content:space-between;margin-bottom:4px')}><span style={s('font-size:10.5px;font-weight:600;color:var(--d-muted)')}>30d</span><span className="d-num" style={s('font-size:11.5px;font-weight:700;color:var(--d-ink)')}>{value}%</span></div>
      <div style={s('height:6px;border-radius:3px;background:var(--d-panel2);overflow:hidden')}><div style={{ ...s('height:100%;border-radius:3px'), width: `${value}%`, background: bar }} /></div>
    </div>
  );
}

export default function EmployeesPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [availFor, setAvailFor] = useState(null);
  const [avail, setAvail] = useState([]);
  const [availLoading, setAvailLoading] = useState(false);

  async function load() { setRows(await listEmployees()); }
  async function openAvailability(e) {
    setAvailFor(e); setAvailLoading(true);
    try { setAvail(await getEmployeeAvailability(e.id)); } catch { setAvail([]); } finally { setAvailLoading(false); }
  }

  useEffect(() => { let active = true; load().finally(() => active && setLoading(false)); return () => { active = false; }; }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((e) => (showInactive ? true : e.active))
      .filter((e) => (roleFilter === 'all' ? true : e.role === roleFilter))
      .filter((e) => (q ? `${e.full_name} ${e.email} ${e.employee_reference ?? ''}`.toLowerCase().includes(q) : true));
  }, [rows, query, showInactive, roleFilter]);

  function validate() {
    const next = {};
    if (!form.first_name.trim()) next.first_name = 'Required';
    if (!form.last_name.trim()) next.last_name = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid work email';
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  function openInvite() { setForm(EMPTY); setEditing(null); setErrors({}); setModalOpen(true); }
  function openEdit(e) { setEditing(e); setForm({ first_name: e.first_name, last_name: e.last_name, email: e.email, phone: e.phone ?? '', role: e.role, employee_reference: e.employee_reference ?? '' }); setErrors({}); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) { await updateEmployee(editing.id, form); toast.success('Staff record updated'); }
      else { await inviteEmployee(form); toast.success(`Invitation sent to ${form.email}`); }
      await load(); closeModal(); setForm(EMPTY);
    } catch (err) { toast.error(err.message || 'Could not save'); } finally { setSaving(false); }
  }
  async function toggleActive(e) {
    try { await updateEmployee(e.id, { active: !e.active }); toast.success(e.active ? `${e.first_name} deactivated` : `${e.first_name} reactivated`); await load(); }
    catch (err) { toast.error(err.message || 'Could not update'); }
  }
  async function onEmpAvatar(ev) {
    const file = ev.target.files?.[0]; ev.target.value = '';
    if (!file || !editing) return;
    try { const updated = await uploadEmployeeAvatar(editing.id, file); setEditing(updated); toast.success('Photo updated'); await load(); }
    catch (err) { toast.error(err.message || 'Upload failed'); }
  }
  async function onEmpAvatarRemove() {
    if (!editing) return;
    try { const updated = await removeEmployeeAvatar(editing.id); setEditing(updated); toast.info('Photo removed'); await load(); }
    catch (err) { toast.error(err.message || 'Could not remove'); }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <Spinner fullscreen />;

  const active = rows.filter((e) => e.active);
  const punctVals = active.map((e) => e.punctuality).filter((v) => v != null);
  const avgPunct = punctVals.length ? Math.round(punctVals.reduce((a, b) => a + b, 0) / punctVals.length) : null;
  const appCount = active.filter((e) => e.capture_method === 'gps').length;
  const mfaOn = active.filter((e) => e.mfa_enabled).length;
  const roleTabs = [
    { key: 'all', label: 'All carers', icon: 'users', count: rows.filter((e) => showInactive || e.active).length },
    { key: 'carer', label: 'Carers', icon: 'user', count: rows.filter((e) => e.role === 'carer' && (showInactive || e.active)).length },
    { key: 'senior_carer', label: 'Senior', icon: 'star', count: rows.filter((e) => e.role === 'senior_carer' && (showInactive || e.active)).length },
  ];

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Stat cards */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        <StatCard label="Active carers" value={active.length} hint={`of ${rows.length} on the books`} tone="primary" icon="users" />
        <StatCard label="Average punctuality" value={avgPunct == null ? '—' : `${avgPunct}%`} hint="Rolling 30 days, from clock records" tone="success" icon="check" />
        <StatCard label="App clocking" value={appCount} hint="Remaining use PIN or manual" tone="magenta" icon="fingerprint" />
        <StatCard label="MFA enabled" value={mfaOn} hint="Two-step sign-in on" tone="info" icon="shield" />
      </div>

      {/* Toolbar */}
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
        <div style={s('height:46px;flex:1;min-width:220px;background:var(--d-field);border-radius:23px;display:flex;align-items:center;gap:10px;padding:0 18px')}>
          <Icon name="search" size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or reference" style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
        </div>
        <div onClick={() => setShowInactive((v) => !v)} className="hv" style={{ ...s('height:46px;border-radius:23px;display:flex;align-items:center;gap:8px;padding:0 16px;cursor:pointer;font-size:13px;font-weight:700'), background: showInactive ? 'var(--d-pill)' : 'var(--d-card)', color: showInactive ? 'var(--d-pill-ink)' : 'var(--d-ink2)', '--hbg': showInactive ? 'var(--d-pill-hover)' : 'var(--d-card-hover)' }}><Icon name="eye" size={16} /> Show inactive</div>
        <div style={s('flex:1')} />
        {canManage && <Button variant="primary" icon="plus" onClick={openInvite}>Invite carer</Button>}
      </div>

      {/* Role filter + table */}
      <div style={s('display:flex;flex-direction:column')}>
        <SegTabs tabs={roleTabs} active={roleFilter} onSelect={setRoleFilter} />
        <div style={s('margin-top:12px')}>
          <div style={s('background:var(--d-card);border-radius:18px;padding:12px 14px;overflow:auto')}>
            {filtered.length === 0 ? (
              <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>No carers match.</div>
            ) : (
              <TableWrap minWidth={920}>
                <thead><tr><Th>Carer</Th><Th>Role &amp; reference</Th><Th>Clocking method</Th><Th align="right">Hours this week</Th><Th>Punctuality</Th><Th>Status</Th>{canManage && <Th align="right">Actions</Th>}</tr></thead>
                <tbody>
                  {filtered.map((e) => (
                    <Row key={e.id}>
                      <Td>
                        <span style={s('display:inline-flex;align-items:center;gap:11px;min-width:0')}>
                          <Avatar initials={`${e.first_name[0]}${e.last_name[0]}`} size="sm" src={e.avatar_url} />
                          <span style={s('min-width:0')}>
                            <b style={s('font-weight:700;color:var(--d-ink);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{fullName(e)}</b>
                            <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{e.email}</span>
                          </span>
                        </span>
                      </Td>
                      <Td>{e.role === 'senior_carer' ? 'Senior carer' : 'Carer'}<span style={s('font-size:11.5px;color:var(--d-muted);display:block')}>{e.employee_reference ?? '—'}</span></Td>
                      <Td><Tag tone={e.capture_method === 'gps' ? 'primary' : e.capture_method === 'pin' ? 'info' : 'muted'}>{METHOD[e.capture_method] ?? '—'}</Tag></Td>
                      <Td align="right" mono><b style={s('font-weight:700;color:var(--d-ink)')}>{e.hours_this_week != null ? `${e.hours_this_week}h` : '—'}</b></Td>
                      <Td><Meter value={e.punctuality} /></Td>
                      <Td><Tag tone={e.active ? 'success' : 'muted'}>{e.active ? 'Active' : 'Inactive'}</Tag></Td>
                      {canManage && (
                        <Td align="right">
                          <span style={s('display:inline-flex;gap:8px;justify-content:flex-end')}>
                            <Button size="sm" icon="calendar" onClick={() => openAvailability(e)}>Availability</Button>
                            <Button size="sm" onClick={() => openEdit(e)}>Edit</Button>
                            <Button size="sm" variant={e.active ? 'danger' : 'ghost'} onClick={() => toggleActive(e)}>{e.active ? 'Deactivate' : 'Reactivate'}</Button>
                          </span>
                        </Td>
                      )}
                    </Row>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>
        </div>
      </div>

      {/* Invite / edit modal */}
      {modalOpen && (
        <div onClick={closeModal} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(ev) => ev.stopPropagation()} style={s('width:100%;max-width:520px;max-height:88vh;background:var(--d-card);border-radius:28px;display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 8px;display:flex;align-items:center')}>
              <div style={s('font-size:19px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>{editing ? `Edit ${editing.first_name}` : 'Invite a carer'}</div>
              <div style={s('flex:1')} />
              <div onClick={closeModal} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:8px 24px 4px;display:flex;flex-direction:column;gap:16px')}>
              {!editing && <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);line-height:1.5')}>They get an email with a link to set their own password. The account stays inactive until they use it.</div>}
              {editing && (
                <div style={s('display:flex;align-items:center;gap:14px')}>
                  <Avatar initials={`${editing.first_name[0]}${editing.last_name[0]}`} src={editing.avatar_url} />
                  <div style={s('display:flex;gap:8px')}>
                    <label className="hv" style={{ ...s('display:inline-flex;align-items:center;gap:6px;height:34px;border-radius:17px;border:1px solid var(--d-border);padding:0 14px;font-size:12.5px;font-weight:700;color:var(--d-ink);cursor:pointer'), '--hbg': 'var(--d-panel)' }}>
                      <Icon name="camera" size={14} />{editing.avatar_url ? 'Change photo' : 'Upload photo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onEmpAvatar} />
                    </label>
                    {editing.avatar_url && <Button size="sm" onClick={onEmpAvatarRemove}>Remove</Button>}
                  </div>
                </div>
              )}
              <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:14px')}>
                <Field label="First name" error={errors.first_name}><input style={input(errors.first_name)} value={form.first_name} onChange={set('first_name')} /></Field>
                <Field label="Last name" error={errors.last_name}><input style={input(errors.last_name)} value={form.last_name} onChange={set('last_name')} /></Field>
              </div>
              <Field label="Work email" error={errors.email} hint={editing ? 'Email is the sign-in name and cannot be changed here.' : undefined}><input style={input(errors.email, !!editing)} type="email" value={form.email} onChange={set('email')} disabled={!!editing} /></Field>
              <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:14px')}>
                <Field label="Mobile"><input style={input(false)} value={form.phone} onChange={set('phone')} placeholder="07700 900000" /></Field>
                <Field label="Role"><select style={input(false)} value={form.role} onChange={set('role')}><option value="carer">Carer</option><option value="senior_carer">Senior carer</option></select></Field>
              </div>
              <Field label="Staff reference"><input style={input(false)} value={form.employee_reference} onChange={set('employee_reference')} placeholder="EMP-0000" /></Field>
            </div>
            <div style={s('padding:16px 24px 22px;display:flex;justify-content:flex-end;gap:10px')}>
              <Button onClick={closeModal}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={saving ? undefined : handleSave}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Send invitation'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Availability drawer */}
      {availFor && (
        <div onClick={() => setAvailFor(null)} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.42);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(ev) => ev.stopPropagation()} style={s('width:100%;max-width:420px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 16px;border-bottom:1px solid var(--d-border);display:flex;align-items:center;gap:12px')}>
              <Avatar initials={`${availFor.first_name[0]}${availFor.last_name[0]}`} src={availFor.avatar_url} />
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:16px;font-weight:700;color:var(--d-ink)')}>{fullName(availFor)}</div>
                <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Availability{availFor.contracted_hours_per_week ? ` · ${availFor.contracted_hours_per_week}h contracted` : ''}</div>
              </div>
              <div onClick={() => setAvailFor(null)} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px')}>
              {availLoading ? <div style={s('margin:auto;font-size:13px;color:var(--d-muted)')}>Loading…</div>
                : avail.length === 0 ? <div style={s('padding:40px 16px;text-align:center;font-size:13px;font-weight:600;color:var(--d-ink2)')}>No availability recorded.<div style={s('font-size:12px;font-weight:500;color:var(--d-muted);margin-top:4px')}>The carer sets this in the mobile app.</div></div>
                : [0, 1, 2, 3, 4, 5, 6].map((wd) => {
                  const slots = avail.filter((a) => a.weekday === wd && a.available);
                  return (
                    <div key={wd} style={s('display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--d-panel)')}>
                      <div style={s('width:84px;flex:none;font-size:13px;font-weight:700;color:var(--d-ink)')}>{DAYS[wd]}</div>
                      <div style={s('flex:1;display:flex;gap:6px;flex-wrap:wrap')}>
                        {slots.length === 0 ? <span style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Not available</span>
                          : slots.map((a) => <Tag key={a.id ?? a.slot} tone="success">{String(a.slot).replace(/_/g, ' ')}</Tag>)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
