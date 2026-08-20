import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Button } from '../../ds/console.jsx';
import { s } from '../../lib/ui.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { enablePush, pushSupported, pushPermission, isSubscribed } from '../../lib/push.js';

// A gentle, dismissable nudge to turn on push notifications — shown app-wide
// above the page content, but ONLY to admins who haven't decided yet.
//
// Deliberately NOT a raw permission popup on load (browsers penalise those and
// it feels pushy). The actual permission prompt still fires from the button
// click, which is the honest, browser-friendly pattern. We never nag someone
// who has already enabled, already blocked, can't use push, or dismissed this.
const DISMISS_KEY = 'bpc.admin.pushPromptDismissed';

export default function PushOptInBanner() {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = '1';
    try { dismissed = localStorage.getItem(DISMISS_KEY); } catch { /* treat as dismissed */ }
    if (dismissed) return;
    if (!pushSupported() || pushPermission() !== 'default') return;
    // Don't offer if this browser is somehow already subscribed.
    isSubscribed().then((sub) => { if (!sub) setShow(true); }).catch(() => setShow(true));
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  async function enable() {
    setBusy(true);
    try {
      const res = await enablePush();
      if (res.ok) {
        toast.success('Notifications are on for this browser');
        dismiss();
      } else if (res.reason === 'denied') {
        // They blocked it at the OS prompt — stop nagging.
        toast.error('Notifications are blocked. You can allow them in your browser settings.');
        dismiss();
      } else {
        toast.error('Could not turn on notifications.');
      }
    } catch (e) {
      toast.error(e.message || 'Could not turn on notifications');
    } finally { setBusy(false); }
  }

  if (!show) return null;

  return (
    <div style={s('display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--d-primary-soft);border-radius:16px;padding:13px 16px')}>
      <div style={s('width:34px;height:34px;border-radius:10px;background:var(--d-primary);color:var(--d-primary-ink);display:flex;align-items:center;justify-content:center;flex:none')}>
        <Icon name="bell" size={17} />
      </div>
      <div style={s('flex:1;min-width:200px')}>
        <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>Turn on notifications</div>
        <div style={s('font-size:12px;font-weight:500;color:var(--d-ink2);margin-top:1px;line-height:1.45')}>Get missed clock-ins, escalations and messages even when this tab is closed.</div>
      </div>
      <Button variant="primary" icon="bell" disabled={busy} onClick={busy ? undefined : enable}>{busy ? 'Enabling…' : 'Enable'}</Button>
      <div onClick={dismiss} className="hv tip" data-tip="Not now"
        style={{ ...s('width:32px;height:32px;border-radius:50%;background:var(--d-card);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2);flex:none'), '--hbg': 'var(--d-card-hover)' }}>
        <Icon name="close" size={15} />
      </div>
    </div>
  );
}
