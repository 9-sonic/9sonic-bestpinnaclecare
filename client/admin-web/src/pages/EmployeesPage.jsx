import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listEmployees, inviteEmployee } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName } from '../api/format.js';
import { StatCard, Tag, Avatar, Button, TableWrap, Th, Td, Row } from '../ds/console.jsx';
import CarerProfileDrawer from './CarerProfileDrawer.jsx';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', employee_reference: '' };
const METHOD = { gps: 'App (GPS)', pin: 'PIN tablet', manual_admin: 'Manual', manual: 'Manual' };

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
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  async function load() { setRows(await listEmployees()); }
  useEffect(() => { let active = true; load().finally(() => active && setLoading(false)); return () => { active = false; }; }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((e) => (showInactive ? true : e.active))
      .filter((e) => (q ? `${e.full_name} ${e.email} ${e.employee_reference ?? ''}`.toLowerCase().includes(q) : true));
  }, [rows, query, showInactive]);

  function validate() {
    const next = {};
    if (!form.first_name.trim()) next.first_name = 'Required';
    if (!form.last_name.trim()) next.last_name = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid work email';
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  // Invite only — editing a carer lives on their detail page (/employees/:id).
  function openInvite() { setForm(EMPTY); setErrors({}); setModalOpen(true); }
  function closeModal() { setModalOpen(false); }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await inviteEmployee(form);
      toast.success(`Invitation sent to ${form.email}`);
      await load(); closeModal(); setForm(EMPTY);
    } catch (err) { toast.error(err.message || 'Could not save'); } finally { setSaving(false); }
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <Spinner fullscreen />;

  const active = rows.filter((e) => e.active);
  const punctVals = active.map((e) => e.punctuality).filter((v) => v != null);
  const avgPunct = punctVals.length ? Math.round(punctVals.reduce((a, b) => a + b, 0) / punctVals.length) : null;
  const appCount = active.filter((e) => e.capture_method === 'gps').length;
  const mfaOn = active.filter((e) => e.mfa_enabled).length;

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

      {/* Staff table */}
      <div style={s('display:flex;flex-direction:column')}>
        <div>
          <div style={s('background:var(--d-card);border-radius:18px;padding:12px 14px;overflow:auto')}>
            {filtered.length === 0 ? (
              <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>No carers match.</div>
            ) : (
              <TableWrap minWidth={920}>
                <thead><tr><Th>Carer</Th><Th>Reference</Th><Th>Clocking method</Th><Th align="right">Hours this week</Th><Th>Punctuality</Th><Th>Status</Th><Th align="right" /></tr></thead>
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
                      <Td>{e.employee_reference ?? '—'}</Td>
                      <Td><Tag tone={e.capture_method === 'gps' ? 'primary' : e.capture_method === 'pin' ? 'info' : 'muted'}>{METHOD[e.capture_method] ?? '—'}</Tag></Td>
                      <Td align="right" mono><b style={s('font-weight:700;color:var(--d-ink)')}>{e.hours_this_week != null ? `${e.hours_this_week}h` : '—'}</b></Td>
                      <Td><Meter value={e.punctuality} /></Td>
                      <Td><Tag tone={e.active ? 'success' : 'muted'}>{e.active ? 'Active' : 'Inactive'}</Tag></Td>
                      <Td align="right">
                        <Button size="sm" icon="user" onClick={() => navigate(`/employees/${e.id}`)}>View</Button>
                      </Td>
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
              <div style={s('font-size:19px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>Invite a carer</div>
              <div style={s('flex:1')} />
              <div onClick={closeModal} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:8px 24px 4px;display:flex;flex-direction:column;gap:16px')}>
              <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);line-height:1.5')}>They get an email with a link to set their own password. The account stays inactive until they use it.</div>
              <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:14px')}>
                <Field label="First name" error={errors.first_name}><input style={input(errors.first_name)} value={form.first_name} onChange={set('first_name')} /></Field>
                <Field label="Last name" error={errors.last_name}><input style={input(errors.last_name)} value={form.last_name} onChange={set('last_name')} /></Field>
              </div>
              <Field label="Work email" error={errors.email}><input style={input(errors.email)} type="email" value={form.email} onChange={set('email')} /></Field>
              <Field label="Mobile"><input style={input(false)} value={form.phone} onChange={set('phone')} placeholder="07700 900000" /></Field>
              <Field label="Staff reference"><input style={input(false)} value={form.employee_reference} onChange={set('employee_reference')} placeholder="EMP-0000" /></Field>
            </div>
            <div style={s('padding:16px 24px 22px;display:flex;justify-content:flex-end;gap:10px')}>
              <Button onClick={closeModal}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={saving ? undefined : handleSave}>{saving ? 'Saving…' : 'Send invitation'}</Button>
            </div>
          </div>
        </div>
      )}

      {profileFor && <CarerProfileDrawer carer={profileFor} onClose={() => setProfileFor(null)} />}
    </div>
  );
}
