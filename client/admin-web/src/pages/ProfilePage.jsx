import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { uploadMyAvatar, removeMyAvatar, updateMyProfile } from '../api/index.js';
import { Panel, PanelTitle, Button, Tag, fieldStyle as dsFieldStyle } from '../ds/console.jsx';
import { s } from '../lib/ui.jsx';
import { enablePush, disablePush, pushPermission, isSubscribed } from '../lib/push.js';

// The admin's own profile: photo + personal details, wired to /admin/me and
// /admin/me/avatar. Role and active status are deliberately read-only here —
// those are a registered manager's job (see the Team page), not self-service.

const ROLE_LABEL = {
  registered_manager: 'Registered manager',
  manager: 'Manager',
  coordinator: 'Coordinator',
  auditor: 'Auditor',
};

const fieldStyle = dsFieldStyle();

function Field({ label, children }) {
  return (
    <label style={s('display:flex;flex-direction:column;gap:6px')}>
      <span style={s('font-size:12px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
      {children}
    </label>
  );
}

// Push notifications for this browser. The admin turns them on with a click
// (browsers require a user gesture for the permission prompt), which registers
// this device so critical alerts and messages arrive even with the tab closed.
function NotificationsPanel() {
  const toast = useToast();
  const [permission, setPermission] = useState('default'); // 'unsupported'|'denied'|'granted'|'default'
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(pushPermission());
    isSubscribed().then(setSubscribed).catch(() => setSubscribed(false));
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const res = await enablePush();
      if (res.ok) {
        setPermission('granted'); setSubscribed(true);
        toast.success('Notifications are on for this browser');
      } else {
        const msg = {
          unsupported: 'This browser does not support notifications.',
          denied: 'Notifications are blocked. Allow them in your browser settings, then try again.',
          not_configured: 'Push is not set up on the server yet.',
        }[res.reason] || 'Could not turn on notifications.';
        setPermission(pushPermission());
        toast.error(msg);
      }
    } catch (e) {
      toast.error(e.message || 'Could not turn on notifications');
    } finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      setSubscribed(false);
      toast.info('Notifications turned off for this browser');
    } catch (e) {
      toast.error(e.message || 'Could not turn off notifications');
    } finally { setBusy(false); }
  }

  return (
    <Panel>
      <PanelTitle hint="Get missed clock-ins, escalations and messages even when this tab is closed">Notifications</PanelTitle>
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px')}>
        {permission === 'unsupported' ? (
          <span style={s('font-size:13px;font-weight:500;color:var(--d-muted)')}>This browser does not support push notifications.</span>
        ) : subscribed ? (
          <>
            <Tag tone="success">On for this browser</Tag>
            <span style={s('flex:1;min-width:20px')} />
            <Button icon="close" disabled={busy} onClick={busy ? undefined : turnOff}>{busy ? 'Working…' : 'Turn off'}</Button>
          </>
        ) : (
          <>
            <span style={s('font-size:13px;font-weight:500;color:var(--d-ink2)')}>
              {permission === 'denied'
                ? 'Notifications are blocked in your browser. Allow them in site settings, then enable here.'
                : 'Turn on browser notifications for this device.'}
            </span>
            <span style={s('flex:1;min-width:20px')} />
            <Button variant="primary" icon="bell" disabled={busy} onClick={busy ? undefined : turnOn}>{busy ? 'Enabling…' : 'Enable notifications'}</Button>
          </>
        )}
      </div>
    </Panel>
  );
}

export default function ProfilePage({ embedded = false }) {
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
    <div style={s(`display:flex;flex-direction:column;gap:16px${embedded ? '' : ';max-width:720px'}`)}>
      {!embedded && (
        <div>
          <h1 style={s('font-size:22px;font-weight:700;color:var(--d-ink);letter-spacing:-0.4px')}>My profile</h1>
          <p style={s('font-size:13px;font-weight:500;color:var(--d-muted);margin-top:4px')}>
            Your photo and personal details. Role and access are managed by a registered manager.
          </p>
        </div>
      )}

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

      <NotificationsPanel />
    </div>
  );
}
