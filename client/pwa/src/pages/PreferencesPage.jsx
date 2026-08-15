import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useBiometric } from '../hooks/useBiometric.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { requestPasswordReset } from '../api/auth.js';

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
  const [shiftAlerts, setShiftAlerts] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [largeText, setLargeText] = useState(
    () => document.documentElement.dataset.textSize === 'large'
  );
  const [passwordBusy, setPasswordBusy] = useState(false);

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
          icon="calendar"
          tint={TINTS.teal}
          label="Shift changes"
          hint="When a visit is added, moved or cancelled"
          trailing={
            <Switch on={shiftAlerts} onChange={() => setShiftAlerts((v) => !v)} label="Shift changes" />
          }
        />
        <Row
          icon="chat"
          tint={TINTS.info}
          label="Messages"
          hint="New messages from your team"
          trailing={
            <Switch
              on={messageAlerts}
              onChange={() => setMessageAlerts((v) => !v)}
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
            <Switch on={reminders} onChange={() => setReminders((v) => !v)} label="Reminders" />
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
