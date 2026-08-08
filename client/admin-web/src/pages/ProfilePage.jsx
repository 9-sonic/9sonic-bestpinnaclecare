import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { uploadMyAvatar, removeMyAvatar, updateMyProfile } from '../api/index.js';
import { Panel, PanelTitle, Button, Tag } from '../ds/console.jsx';
import { s } from '../lib/ui.jsx';

// The admin's own profile: photo + personal details, wired to /admin/me and
// /admin/me/avatar. Role and active status are deliberately read-only here —
// those are a registered manager's job (see the Team page), not self-service.

const ROLE_LABEL = {
  registered_manager: 'Registered manager',
  manager: 'Manager',
  coordinator: 'Coordinator',
  finance: 'Finance',
  auditor: 'Auditor',
};

const fieldStyle = {
  ...s('height:46px;border-radius:14px;background:var(--d-field);padding:0 15px;font-size:14px;font-weight:500;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%;border:1.5px solid transparent'),
  fontFamily: 'inherit',
};

function Field({ label, children }) {
  return (
    <label style={s('display:flex;flex-direction:column;gap:6px')}>
      <span style={s('font-size:12px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
      {children}
    </label>
  );
}

export default function ProfilePage() {
  const { admin, refreshAdmin } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [firstName, setFirstName] = useState(admin?.first_name ?? '');
  const [lastName, setLastName] = useState(admin?.last_name ?? '');
  const [phone, setPhone] = useState(admin?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const initials = `${admin?.first_name?.[0] ?? ''}${admin?.last_name?.[0] ?? ''}`.toUpperCase() || 'BP';
  const dirty =
    firstName !== (admin?.first_name ?? '') ||
    lastName !== (admin?.last_name ?? '') ||
    phone !== (admin?.phone ?? '');

  async function onAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try { await uploadMyAvatar(file); await refreshAdmin?.(); toast.success('Photo updated'); }
    catch (err) { toast.error(err.message || 'Could not upload that image'); }
    finally { setAvatarBusy(false); }
  }

  async function onRemoveAvatar() {
    setAvatarBusy(true);
    try { await removeMyAvatar(); await refreshAdmin?.(); toast.info('Photo removed'); }
    catch (err) { toast.error(err.message || 'Could not remove the photo'); }
    finally { setAvatarBusy(false); }
  }

  async function save() {
    if (!firstName.trim() || !lastName.trim()) { toast.error('First and last name are required'); return; }
    setSaving(true);
    try {
      await updateMyProfile({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null });
      await refreshAdmin?.();
      toast.success('Profile saved');
    } catch (err) { toast.error(err.message || 'Could not save your profile'); }
    finally { setSaving(false); }
  }

  return (
    <div style={s('display:flex;flex-direction:column;gap:18px;max-width:720px')}>
      <div>
        <h1 style={s('font-size:22px;font-weight:700;color:var(--d-ink);letter-spacing:-0.4px')}>My profile</h1>
        <p style={s('font-size:13px;font-weight:500;color:var(--d-muted);margin-top:4px')}>
          Your photo and personal details. Role and access are managed by a registered manager.
        </p>
      </div>

      <Panel>
        <PanelTitle>Photo</PanelTitle>
        <div style={s('display:flex;align-items:center;gap:18px;margin-top:14px;flex-wrap:wrap')}>
          <div style={s('width:76px;height:76px;border-radius:50%;overflow:hidden;flex:none;background:var(--d-sage);display:flex;align-items:center;justify-content:center')}>
            {admin?.avatar_url
              ? <img src={admin.avatar_url} alt="" style={s('width:76px;height:76px;object-fit:cover;display:block')} />
              : <span style={s('color:var(--d-ink2);font-size:24px;font-weight:700')}>{initials}</span>}
          </div>
          <div style={s('display:flex;gap:8px;flex-wrap:wrap')}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={onAvatarPick} />
            <Button variant="primary" icon="camera" onClick={avatarBusy ? undefined : () => fileRef.current?.click()}>
              {avatarBusy ? 'Working…' : 'Change photo'}
            </Button>
            {admin?.avatar_url && <Button icon="close" onClick={avatarBusy ? undefined : onRemoveAvatar}>Remove</Button>}
          </div>
        </div>
        <p style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:12px')}>PNG, JPG, WEBP or GIF, up to 5 MB.</p>
      </Panel>

      <Panel>
        <PanelTitle>Personal details</PanelTitle>
        <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:14px')}>
          <Field label="First name"><input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={fieldStyle} /></Field>
          <Field label="Last name"><input value={lastName} onChange={(e) => setLastName(e.target.value)} style={fieldStyle} /></Field>
          <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" style={fieldStyle} /></Field>
          <Field label="Work email"><input value={admin?.email ?? ''} disabled style={{ ...fieldStyle, opacity: 0.6, cursor: 'not-allowed' }} /></Field>
        </div>
        <div style={s('display:flex;align-items:center;gap:8px;margin-top:16px;flex-wrap:wrap')}>
          <Tag tone="info">{ROLE_LABEL[admin?.role] ?? admin?.role}</Tag>
          <Tag tone={admin?.mfa_enabled ? 'success' : 'muted'}>{admin?.mfa_enabled ? 'Two-step on' : 'Two-step off'}</Tag>
          <span style={s('flex:1;min-width:20px')} />
          <Button variant="primary" icon="check" disabled={!dirty || saving} onClick={(!dirty || saving) ? undefined : save}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
