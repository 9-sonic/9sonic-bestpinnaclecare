import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName } from '../api/format.js';
import { listAdmins, inviteAdmin, updateAdmin } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import { StatCard, Tag, Avatar, Button, TableWrap, Th, Td, Row, Pager } from '../ds/console.jsx';

// Office users (the admins table). Inviting / editing is the registered
// manager's job — the API enforces that too; here we just hide the controls.
const ROLES = ['registered_manager', 'manager', 'coordinator', 'finance', 'auditor'];
const ROLE_LABELS = {
  registered_manager: 'Registered manager',
  manager: 'Manager',
  coordinator: 'Coordinator',
  finance: 'Finance',
  auditor: 'Auditor',
};
const EMPTY = { email: '', first_name: '', last_name: '', role: 'coordinator' };

function Field({ label, error, hint, children }) {
  return (
    <label style={s('display:flex;flex-direction:column;gap:7px')}>
      <span style={s('font-size:12.5px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
      {children}
      {error && <span style={s('font-size:12px;font-weight:600;color:var(--d-danger-ink)')}>{error}</span>}
      {hint && !error && <span style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>{hint}</span>}
    </label>
  );
}
const input = (error, disabled) => ({ ...s('height:46px;border-radius:16px;background:var(--d-field);padding:0 16px;font-size:14px;font-weight:500;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%'), fontFamily: 'inherit', border: `1.5px solid ${error ? 'var(--d-danger-ink)' : 'transparent'}`, opacity: disabled ? 0.6 : 1 });

// active + accepted -> Active; active + not accepted -> Invite pending; else Inactive.
function statusOf(a) {
  if (!a.active) return { label: 'Inactive', tone: 'muted' };
  if (!a.accepted_invite_at) return { label: 'Invite pending', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}

export default function TeamPage() {
  const toast = useToast();
  const { admin } = useAuth();
  const isOwner = admin?.role === 'registered_manager';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() { setRows(await listAdmins()); }
  useEffect(() => { let on = true; load().finally(() => on && setLoading(false)); return () => { on = false; }; }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((a) => (q ? `${a.full_name} ${a.email} ${ROLE_LABELS[a.role] ?? ''}`.toLowerCase().includes(q) : true));
  }, [rows, query]);

  const PER_PAGE = 20;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [query]);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  function openInvite() { setForm(EMPTY); setEditing(null); setActive(true); setErrors({}); setModalOpen(true); }
  function openEdit(a) { setEditing(a); setForm({ email: a.email, first_name: a.first_name, last_name: a.last_name, role: a.role }); setActive(a.active); setErrors({}); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  function validate() {
    const next = {};
    if (!form.first_name.trim()) next.first_name = 'Required';
    if (!form.last_name.trim()) next.last_name = 'Required';
    if (!editing && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid work email';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateAdmin(editing.id, { first_name: form.first_name, last_name: form.last_name, role: form.role, active });
        toast.success('Team member updated');
      } else {
        await inviteAdmin({ email: form.email, first_name: form.first_name, last_name: form.last_name, role: form.role });
        toast.success(`Invitation sent to ${form.email}`);
      }
      await load(); closeModal();
    } catch (err) { toast.error(err.message || 'Could not save'); } finally { setSaving(false); }
  }

  async function toggleActive(a) {
    try { await updateAdmin(a.id, { active: !a.active }); toast.success(a.active ? `${a.first_name} deactivated` : `${a.first_name} reactivated`); await load(); }
    catch (err) { toast.error(err.message || 'Could not update'); }
  }

  if (loading) return <Spinner fullscreen />;

  const activeAdmins = rows.filter((a) => a.active);
  const pending = rows.filter((a) => a.active && !a.accepted_invite_at).length;
  const mfaOn = activeAdmins.filter((a) => a.mfa_enabled).length;

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        <StatCard label="Office users" value={activeAdmins.length} hint={`of ${rows.length} on the books`} tone="primary" icon="shield" />
        <StatCard label="Invites pending" value={pending} hint="Not yet accepted" tone="warning" icon="note" />
        <StatCard label="MFA enabled" value={mfaOn} hint="Two-step sign-in on" tone="success" icon="shield" />
        <StatCard label="Registered managers" value={rows.filter((a) => a.role === 'registered_manager' && a.active).length} hint="Full access" tone="info" icon="star" />
      </div>

      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
        <div style={s('height:46px;flex:1;min-width:220px;background:var(--d-field);border-radius:23px;display:flex;align-items:center;gap:10px;padding:0 18px')}>
          <Icon name="search" size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or role" style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
        </div>
        <div style={s('flex:1')} />
        {isOwner
          ? <Button variant="primary" icon="plus" onClick={openInvite}>Invite office user</Button>
          : <div style={s('font-size:12.5px;font-weight:600;color:var(--d-muted)')}>Only a registered manager can invite office users.</div>}
      </div>

      <div style={s('background:var(--d-card);border-radius:18px;padding:12px 14px;overflow:auto')}>
        {filtered.length === 0 ? (
          <div style={s('padding:44px 20px;text-align:center;font-size:13.5px;font-weight:600;color:var(--d-muted)')}>No office users match.</div>
        ) : (
          <TableWrap minWidth={860}>
            <thead><tr><Th>Person</Th><Th>Role</Th><Th>Two-step</Th><Th>Status</Th>{isOwner && <Th align="right">Actions</Th>}</tr></thead>
            <tbody>
              {paged.map((a) => {
                const st = statusOf(a);
                return (
                  <Row key={a.id}>
                    <Td>
                      <span style={s('display:inline-flex;align-items:center;gap:11px;min-width:0')}>
                        <Avatar initials={`${a.first_name[0]}${a.last_name[0]}`} size="sm" src={a.avatar_url} />
                        <span style={s('min-width:0')}>
                          <b style={s('font-weight:700;color:var(--d-ink);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{fullName(a)}{a.id === admin?.id ? ' (you)' : ''}</b>
                          <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{a.email}</span>
                        </span>
                      </span>
                    </Td>
                    <Td><Tag tone={a.role === 'registered_manager' ? 'primary' : 'muted'}>{ROLE_LABELS[a.role] ?? a.role}</Tag></Td>
                    <Td><Tag tone={a.mfa_enabled ? 'success' : 'warning'}>{a.mfa_enabled ? 'On' : 'Off'}</Tag></Td>
                    <Td><Tag tone={st.tone}>{st.label}</Tag></Td>
                    {isOwner && (
                      <Td align="right">
                        <span style={s('display:inline-flex;gap:8px;justify-content:flex-end')}>
                          <Button size="sm" icon="edit" onClick={() => openEdit(a)}>Edit</Button>
                          {a.id !== admin?.id && <Button size="sm" onClick={() => toggleActive(a)}>{a.active ? 'Deactivate' : 'Reactivate'}</Button>}
                        </span>
                      </Td>
                    )}
                  </Row>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </div>
      <Pager page={page} perPage={PER_PAGE} total={filtered.length} onPage={setPage} />

      {modalOpen && (
        <div onClick={closeModal} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
          <div onClick={(ev) => ev.stopPropagation()} style={s('width:100%;max-width:520px;max-height:88vh;background:var(--d-card);border-radius:28px;display:flex;flex-direction:column;overflow:hidden')}>
            <div style={s('padding:22px 24px 8px;display:flex;align-items:center')}>
              <div style={s('font-size:19px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>{editing ? `Edit ${editing.first_name}` : 'Invite an office user'}</div>
              <div style={s('flex:1')} />
              <div onClick={closeModal} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
            </div>
            <div style={s('flex:1;overflow-y:auto;padding:8px 24px 4px;display:flex;flex-direction:column;gap:16px')}>
              {!editing && <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);line-height:1.5')}>They get an email with a link to set their own password, then set up two-step sign-in on first login. The account stays pending until they accept.</div>}
              <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:14px')}>
                <Field label="First name" error={errors.first_name}><input style={input(errors.first_name)} value={form.first_name} onChange={set('first_name')} /></Field>
                <Field label="Last name" error={errors.last_name}><input style={input(errors.last_name)} value={form.last_name} onChange={set('last_name')} /></Field>
              </div>
              <Field label="Work email" error={errors.email} hint={editing ? 'Email is the sign-in name and cannot be changed here.' : undefined}><input style={input(errors.email, !!editing)} type="email" value={form.email} onChange={set('email')} disabled={!!editing} /></Field>
              <Field label="Role"><select style={input(false)} value={form.role} onChange={set('role')}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
              {editing && editing.id !== admin?.id && (
                <label style={s('display:flex;align-items:center;gap:10px;cursor:pointer')}>
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  <span style={s('font-size:13px;font-weight:600;color:var(--d-ink2)')}>Account active</span>
                </label>
              )}
            </div>
            <div style={s('padding:16px 24px 22px;display:flex;justify-content:flex-end;gap:10px')}>
              <Button onClick={closeModal}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={saving ? undefined : handleSave}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Send invitation'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
