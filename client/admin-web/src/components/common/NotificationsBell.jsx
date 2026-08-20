import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';
import { listNotifications, markAllNotificationsSeen, markNotificationSeen } from '../../api/index.js';
import { subscribeInbox } from '../../lib/cable.js';
import { formatTime, formatDate } from '../../api/format.js';

// Bell in the top bar: unseen notifications with a count badge and a dropdown.
// Reads /notifications; degrades quietly to nothing if the call fails.
const REFRESH_MS = 60000;
const ICON = {
  visit_late: 'clock', no_clock_out: 'clock', unassigned_visit: 'user',
  visit_missed: 'alert', geofence_fail: 'pin', clock_in_failed: 'offline',
  message: 'chat',
};

export default function NotificationsBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  async function load() {
    try { setItems((await listNotifications({ limit: 20 })) ?? []); } catch { /* quiet */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  // Live: a notification pushed over the cable lands in the bell immediately
  // (badge updates without waiting for the 60s poll). The sound is handled once
  // in AdminLayout so it doesn't double-ring.
  useEffect(() => {
    const off = subscribeInbox((payload) => {
      if (payload?.type !== 'notification' || !payload.notification) return;
      setItems((xs) => (xs.some((n) => n.id === payload.notification.id) ? xs : [payload.notification, ...xs]));
    });
    return off;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const unseen = items.filter((n) => !n.seen_at);

  async function markAll() {
    try { await markAllNotificationsSeen(); setItems((xs) => xs.map((n) => ({ ...n, seen_at: n.seen_at ?? new Date().toISOString() }))); }
    catch { /* quiet */ }
  }

  async function openItem(n) {
    if (!n.seen_at) { try { await markNotificationSeen(n.id); } catch { /* quiet */ } setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, seen_at: new Date().toISOString() } : x))); }
    setOpen(false);
    if (n.alert_id) navigate('/alerts');
    else if (n.notification_type === 'message') navigate('/messages');
    else if (n.subject_type) navigate('/exceptions');
  }

  return (
    <div ref={ref} style={s('position:relative')}>
      <div onClick={() => setOpen((v) => !v)} className="hv tip" data-tip="Notifications"
        style={{ ...s('width:46px;height:46px;border-radius:50%;background:var(--d-card);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2);position:relative'), '--hbg': 'var(--d-card-hover)' }}>
        <Icon name="bell" size={20} />
        {unseen.length > 0 && (
          <div style={s('position:absolute;top:6px;right:6px;min-width:17px;height:17px;border-radius:9px;background:var(--d-danger-dot);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;padding:0 4px;border:2px solid var(--d-panel)')}>{unseen.length}</div>
        )}
      </div>

      {open && (
        <div style={s('position:absolute;top:54px;right:0;width:340px;max-height:70vh;background:var(--d-card);border-radius:20px;border:1px solid var(--d-border);box-shadow:0 20px 50px rgba(0,0,0,0.22);overflow:hidden;display:flex;flex-direction:column;z-index:60')}>
          <div style={s('display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--d-border)')}>
            <div style={s('font-size:14px;font-weight:700;color:var(--d-ink)')}>Notifications</div>
            <div style={s('flex:1')} />
            {unseen.length > 0 && <div onClick={markAll} className="hv" style={{ ...s('font-size:12px;font-weight:700;color:var(--d-primary);cursor:pointer;padding:4px 8px;border-radius:10px'), '--hbg': 'var(--d-panel)' }}>Mark all read</div>}
          </div>
          <div style={s('overflow-y:auto')}>
            {items.length === 0 ? (
              <div style={s('padding:36px 20px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>Nothing new</div>
            ) : (
              items.map((n) => (
                <div key={n.id} onClick={() => openItem(n)} className="hv" style={{ ...s('display:flex;gap:12px;padding:13px 16px;cursor:pointer;border-bottom:1px solid var(--d-border)'), '--hbg': 'var(--d-panel)' }}>
                  <div style={{ ...s('width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none'), background: n.seen_at ? 'var(--d-sage)' : 'var(--d-primary-soft)', color: n.seen_at ? 'var(--d-muted)' : 'var(--d-primary-deep)' }}>
                    <Icon name={ICON[n.notification_type] ?? 'bell'} size={16} />
                  </div>
                  <div style={s('flex:1;min-width:0')}>
                    <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink)')}>{n.title}</div>
                    {n.body && <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.4;margin-top:1px')}>{n.body}</div>}
                    <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:3px')}>{formatDate(n.created_at)} {formatTime(n.created_at)}</div>
                  </div>
                  {!n.seen_at && <div style={s('width:8px;height:8px;border-radius:50%;background:var(--d-primary);flex:none;margin-top:6px')} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
