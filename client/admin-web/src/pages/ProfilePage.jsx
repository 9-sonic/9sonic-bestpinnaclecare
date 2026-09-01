import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { uploadMyAvatar, removeMyAvatar, updateMyProfile, beginMfaEnrolment, confirmMfaEnrolment } from '../api/index.js';
import { Panel, PanelTitle, Button, Tag, fieldStyle as dsFieldStyle } from '../ds/console.jsx';
import Modal from '../components/common/Modal.jsx';
import { s, imageTooLarge } from '../lib/ui.jsx';
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

// Two-step verification (TOTP). The backend does the real work — POST /admin/mfa
// mints a fresh secret and returns a QR + otpauth URI; /admin/mfa/confirm verifies
// the first code, flips mfa_enabled and hands back one-time backup codes. This is
// just the enrolment surface: scan, confirm, save the backup codes. Once on, the
// login screen already prompts for a code (handled in AuthContext), so there's
// nothing more to wire for sign-in.
function SecurityPanel() {
  const { admin, refreshAdmin } = useAuth();
  const toast = useToast();
  const enabled = !!admin?.mfa_enabled;

  const [step, setStep] = useState(null); // null | 'scan' | 'codes'
  const [enroll, setEnroll] = useState(null); // { qr_svg, otpauth_uri }
  const [otp, setOtp] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [busy, setBusy] = useState(false);

  function close() {
    setStep(null); setEnroll(null); setOtp(''); setBackupCodes([]); setBusy(false);
  }

  async function begin() {
    setBusy(true);
    try {
      const res = await beginMfaEnrolment();
      setEnroll(res);
      setStep('scan');
    } catch (e) {
      toast.error(e.message || 'Could not start two-step setup');
    } finally { setBusy(false); }
  }

  async function confirm() {
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) { toast.error('Enter the 6-digit code from your app'); return; }
    setBusy(true);
    try {
      const res = await confirmMfaEnrolment(code);
      setBackupCodes(res.backup_codes || []);
      setStep('codes');
      await refreshAdmin?.();
    } catch (e) {
      // The backend returns 422 invalid_code for a wrong/expired code.
      toast.error(e.status === 422 ? 'That code was not right — check the app and try again' : (e.message || 'Could not confirm the code'));
    } finally { setBusy(false); }
  }

  function copyCodes() {
    navigator.clipboard?.writeText(backupCodes.join('\n'))
      .then(() => toast.success('Backup codes copied'))
      .catch(() => toast.error('Could not copy — select and copy them manually'));
  }

  return (
    <Panel>
      <PanelTitle hint="Require a one-time code from an authenticator app when you sign in">Two-step verification</PanelTitle>
      <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px')}>
        {enabled ? (
          <>
            <Tag tone="success">On for your account</Tag>
            <span style={s('font-size:13px;font-weight:500;color:var(--d-ink2)')}>You’ll enter a code from your authenticator app each time you sign in.</span>
          </>
        ) : (
          <>
            <span style={s('font-size:13px;font-weight:500;color:var(--d-ink2)')}>Add a second step to your login with an authenticator app (Google Authenticator, Authy, 1Password…).</span>
            <span style={s('flex:1;min-width:20px')} />
            <Button variant="primary" icon="shield" disabled={busy} onClick={busy ? undefined : begin}>
              {busy ? 'Starting…' : 'Enable two-step'}
            </Button>
          </>
        )}
      </div>

      {step === 'scan' && (
        <Modal
          title="Scan this with your authenticator app"
          subtitle="Then enter the 6-digit code it shows to finish."
          onClose={close}
          footer={
            <div style={s('display:flex;justify-content:flex-end;gap:8px')}>
              <Button onClick={close}>Cancel</Button>
              <Button variant="primary" icon="check" disabled={busy} onClick={busy ? undefined : confirm}>
                {busy ? 'Confirming…' : 'Confirm & turn on'}
              </Button>
            </div>
          }
        >
          <div style={s('padding:22px 24px;display:flex;flex-direction:column;gap:18px;align-items:center')}>
            <div
              style={s('width:196px;height:196px;background:#fff;border-radius:14px;padding:10px;display:flex;align-items:center;justify-content:center')}
              dangerouslySetInnerHTML={{ __html: enroll?.qr_svg || '' }}
            />
            <div style={s('width:100%')}>
              <div style={s('font-size:12px;font-weight:600;color:var(--d-ink2);margin-bottom:6px')}>Can’t scan? Enter this key manually</div>
              <code style={s('display:block;font-size:12px;word-break:break-all;background:var(--d-panel);border:1px solid var(--d-border);border-radius:10px;padding:10px 12px;color:var(--d-ink2)')}>
                {enroll?.otpauth_uri}
              </code>
            </div>
            <label style={s('width:100%;display:flex;flex-direction:column;gap:6px')}>
              <span style={s('font-size:12px;font-weight:600;color:var(--d-ink2)')}>6-digit code</span>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) confirm(); }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                style={{ ...fieldStyle, letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
              />
            </label>
          </div>
        </Modal>
      )}

      {step === 'codes' && (
        <Modal
          title="Two-step is on — save your backup codes"
          subtitle="Each code works once if you lose your phone. Store them somewhere safe; they won’t be shown again."
          onClose={close}
          footer={
            <div style={s('display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap')}>
              <Button icon="copy" onClick={copyCodes}>Copy codes</Button>
              <Button variant="primary" icon="check" onClick={close}>Done</Button>
            </div>
          }
        >
          <div style={s('padding:22px 24px')}>
            <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
              {backupCodes.map((c) => (
                <code key={c} style={s('font-size:14px;letter-spacing:1px;text-align:center;background:var(--d-panel);border:1px solid var(--d-border);border-radius:10px;padding:10px;color:var(--d-ink)')}>{c}</code>
              ))}
            </div>
          </div>
        </Modal>
      )}
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
    const tooBig = imageTooLarge(file);
    if (tooBig) { toast.error(tooBig); return; }
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

      <SecurityPanel />

      <NotificationsPanel />
    </div>
  );
}
