import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useBiometric } from '../hooks/useBiometric.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { requestPasswordReset } from '../api/auth.js';
import { getPreferences, updatePreferences } from '../api/notifications.js';
import { enablePush, disablePush, pushSupported, pushPermission, isSubscribed } from '../utils/push.js';
import { tapFeedback } from '../utils/haptics.js';

const TINTS = {
  teal: { bg: 'var(--teal-050)', fg: 'var(--color-primary)' },
  green: { bg: 'var(--green-100)', fg: 'var(--green-600)' },
  purple: { bg: 'var(--purple-100)', fg: 'var(--purple-600)' },
  info: { bg: 'var(--color-info-bg)', fg: 'var(--color-info)' },
};

function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' switch--on' : ''}`}
      onClick={onChange}
    >
      <span className="switch__knob" />
    </button>
  );
}

function Row({ icon, tint, label, hint, trailing, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className="list-row" onClick={onClick}>
      <span className="list-row__icon" style={{ background: tint.bg, color: tint.fg }}>
        <Icon name={icon} size={17} />
      </span>
      <span className="list-row__text">
        <span className="list-row__label">{label}</span>
        {hint && <span className="list-row__hint">{hint}</span>}
      </span>
      {trailing ?? (onClick && <Icon name="chevronRight" size={16} />)}
    </Tag>
  );
}

export default function PreferencesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const biometric = useBiometric();

  const [biometricOn, setBiometricOn] = useState(biometric.enrolled);
  // Keyed by the notification_type the API stores — the same vocabulary
  // NotificationsPage renders and the seed data uses. CHANNEL_DEFAULTS on the
  // server is "on unless a row says otherwise", so an absent row means on.
  const [notify, setNotify] = useState({ visit_changed: true, message: true, timesheet_reminder: true });
  const [largeText, setLargeText] = useState(
    () => document.documentElement.dataset.textSize === 'large'
  );
  const [passwordBusy, setPasswordBusy] = useState(false);

  // The device-level switch: does *this browser* have an active push
  // subscription at all. Separate from the per-type rows above, which only
  // decide whether a given event is sent once a device is subscribed — that
  // is why they can stay in their existing on-by-default state without ever
  // having promised push before now.
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushState, setPushState] = useState('checking'); // checking | ready | unsupported | denied

  useEffect(() => {
    let active = true;
    if (!pushSupported()) {
      setPushState('unsupported');
      return undefined;
    }
    if (pushPermission() === 'denied') {
      setPushState('denied');
      return undefined;
    }
    isSubscribed()
      .then((sub) => {
        if (!active) return;
        setPushOn(sub);
        setPushState('ready');
      })
      .catch(() => active && setPushState('ready'));
    return () => {
      active = false;
    };
  }, []);

  async function handlePushToggle() {
    if (pushBusy || pushState === 'unsupported' || pushState === 'denied') return;
    tapFeedback();
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.info('Push notifications turned off on this device');
      } else {
        const res = await enablePush();
        if (res.ok) {
          setPushOn(true);
          toast.success('Push notifications are on for this device');
        } else if (res.reason === 'denied') {
          setPushState('denied');
          toast.error('Notifications are blocked. Allow them in your browser settings to turn this on.');
        } else if (res.reason === 'not_configured') {
          toast.error('Push is not set up on the server yet.');
        } else {
          toast.error('Could not turn on push notifications.');
        }
      }
    } catch {
      toast.error('Could not update push notifications');
    } finally {
      setPushBusy(false);
    }
  }

  // These switches used to be plain useState: they moved, and nothing was
  // written anywhere. Now they read and write real NotificationPreference rows.
  //
  // The carer's `push` choice is stored alongside `in_app` even though nothing
  // sends push yet — the preference is their standing answer, and it is honoured
  // the moment a sender exists rather than silently defaulting to on.
  useEffect(() => {
    let active = true;
    getPreferences()
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        setNotify((prev) => {
          const next = { ...prev };
          rows.forEach((r) => {
            if (r?.notification_type in next) next[r.notification_type] = Boolean(r.in_app);
          });
          return next;
        });
      })
      .catch(() => {
        /* offline or not reachable: the defaults above stand */
      });
    return () => {
      active = false;
    };
  }, []);

  // Optimistic, then reverted if the write fails — a switch that springs back is
  // how the carer learns their choice was not saved.
  async function handleNotify(type) {
    const next = !notify[type];
    setNotify((prev) => ({ ...prev, [type]: next }));
    try {
      await updatePreferences({ notification_type: type, in_app: next, push: next });
    } catch {
      setNotify((prev) => ({ ...prev, [type]: !next }));
      toast.error('Could not save that preference');
    }
  }

  async function handleBiometric() {
    if (biometricOn) {
      biometric.forget();
      setBiometricOn(false);
      toast.info('Biometric sign in turned off on this device');
      return;
    }
    try {
      await biometric.enroll(user?.name ? `${user.name} phone` : 'This device');
      setBiometricOn(true);
      toast.success('Biometric sign in enabled');
    } catch {
      toast.error('This device does not support biometric sign in');
    }
  }

  // Bumps the root font size, which every other size is derived from.
  function handleLargeText() {
    const next = !largeText;
    setLargeText(next);
    document.documentElement.dataset.textSize = next ? 'large' : 'normal';
    localStorage.setItem('bpc.textSize', next ? 'large' : 'normal');
  }

  // Emails a reset link. The API always answers 202, so a sent-looking toast is
  // honest — the carer only hears about it again if the send itself failed.
  async function handleChangePassword() {
    if (passwordBusy || !user?.email) return;
    setPasswordBusy(true);
    try {
      await requestPasswordReset(user.email);
      toast.success('Check your email for a password reset link');
    } catch {
      toast.error('Could not send the reset email. Please try again.');
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="page--flush">
      <ScreenHeader title="Preferences" back onBack={() => navigate('/profile')} />

      <p className="list-group__label">Display</p>
      <Card className="stack-card" padded={false}>
        <Row
          icon="moon"
          tint={TINTS.green}
          label="Dark mode"
          hint="Easier on the eyes at night"
          trailing={<Switch on={dark} onChange={toggle} label="Dark mode" />}
        />
        <Row
          icon="file"
          tint={TINTS.info}
          label="Larger text"
          hint="Increase text size across the app"
          trailing={<Switch on={largeText} onChange={handleLargeText} label="Larger text" />}
        />
      </Card>

      <p className="list-group__label">Notifications</p>
      <Card className="stack-card" padded={false}>
        <Row
          icon="bell"
          tint={TINTS.info}
          label="Push notifications on this device"
          hint={
            pushState === 'unsupported'
              ? 'Not available on this browser'
              : pushState === 'denied'
                ? 'Blocked — allow in your browser settings'
                : 'Get a notification even when the app is closed'
          }
          trailing={
            <Switch
              on={pushOn}
              onChange={handlePushToggle}
              label="Push notifications on this device"
            />
          }
        />
        <Row
          icon="calendar"
          tint={TINTS.teal}
          label="Shift changes"
          hint="When a visit is added, moved or cancelled"
          trailing={
            <Switch
              on={notify.visit_changed}
              onChange={() => handleNotify('visit_changed')}
              label="Shift changes"
            />
          }
        />
        <Row
          icon="chat"
          tint={TINTS.info}
          label="Messages"
          hint="New messages from your team"
          trailing={
            <Switch
              on={notify.message}
              onChange={() => handleNotify('message')}
              label="Messages"
            />
          }
        />
        <Row
          icon="bell"
          tint={TINTS.purple}
          label="Timesheet reminders"
          hint="A nudge before the weekly deadline"
          trailing={
            <Switch
              on={notify.timesheet_reminder}
              onChange={() => handleNotify('timesheet_reminder')}
              label="Reminders"
            />
          }
        />
      </Card>

      <p className="list-group__label">Security</p>
      <Card className="stack-card" padded={false}>
        <Row
          icon="fingerprint"
          tint={TINTS.teal}
          label="Biometric sign in"
          hint={biometric.supported ? 'Face or fingerprint' : 'Not available on this device'}
          trailing={
            <Switch on={biometricOn} onChange={handleBiometric} label="Biometric sign in" />
          }
        />
        <Row
          icon="shield"
          tint={TINTS.green}
          label="Change password"
          hint="We'll email you a reset link"
          onClick={handleChangePassword}
        />
      </Card>
    </div>
  );
}
