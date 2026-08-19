import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import WaveHeader from '../components/common/WaveHeader.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import EditProfileDialog from '../components/profile/EditProfileDialog.jsx';
import InfoSheet from '../components/profile/InfoSheet.jsx';
import InstallHelp from '../components/common/InstallHelp.jsx';
import { queueSize } from '../utils/offlineQueue.js';
import { tapFeedback } from '../utils/haptics.js';

const TINTS = {
  teal: { bg: 'var(--teal-050)', fg: 'var(--color-primary-strong)' },
  blue: { bg: 'var(--color-info-bg)', fg: 'var(--color-info-text)' },
  green: { bg: 'var(--color-success-bg)', fg: 'var(--color-success-text)' },
  purple: { bg: 'var(--purple-100)', fg: 'var(--purple-600)' },
  grey: { bg: 'var(--color-surface-alt)', fg: 'var(--color-text-muted)' },
};

function Row({ icon, tint = TINTS.grey, label, value, onClick, trailing, danger = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`list-row${danger ? ' list-row--danger' : ''}`}
      onClick={onClick ? () => { tapFeedback(); onClick(); } : undefined}
    >
      <span className="list-row__icon" style={danger ? undefined : { background: tint.bg, color: tint.fg }}>
        <Icon name={icon} size={17} />
      </span>
      <span className="list-row__label">{label}</span>
      {value && <span className="list-row__value">{value}</span>}
      {trailing ?? (onClick && <Icon name="chevronRight" size={16} />)}
    </Tag>
  );
}

function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' switch--on' : ''}`}
      onClick={() => { tapFeedback(); onChange(); }}
    >
      <span className="switch__knob" />
    </button>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { installed, isIos, ready, supported, promptInstall } = useInstallPrompt();
  const [iosHelp, setIosHelp] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Terms, privacy and help open as sheets over the profile, not as pages.
  const [sheet, setSheet] = useState(null);

  // Signing out clears anything still waiting to reach the server, so the
  // carer is warned rather than silently losing a clock event.
  const pending = queueSize();

  // The browser only hands over an install prompt once it is satisfied the app
  // qualifies, and never on iOS. Rather than a button that appears to do
  // nothing, fall back to showing how to do it by hand.
  async function handleInstall() {
    if (isIos || !ready) {
      setIosHelp(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'unavailable') setIosHelp(true);
  }

  return (
    <div className="page--flush">
      <WaveHeader height={220} photo curve="profile">
        <div className="profile__bar">
          <span className="profile__bar-spacer" />
          <span className="profile__bar-title">Profile</span>
          <button
            type="button"
            className="icon-btn icon-btn--onDark"
            aria-label="Edit profile"
            onClick={() => { tapFeedback(); setEditing(true); }}
          >
            <Icon name="edit" size={18} />
          </button>
        </div>
      </WaveHeader>

      <div className="profile__hero">
        <button
          type="button"
          className="profile__avatar-btn"
          onClick={() => { tapFeedback(); setEditing(true); }}
          aria-label="Edit profile photo"
        >
          <Avatar name={user?.name ?? ''} src={user?.avatar} size={104} ring />
          <span className="profile__avatar-edit">
            <Icon name="camera" size={13} />
          </span>
        </button>
        <h1 className="profile__name">{user?.name}</h1>
        <p className="profile__role">{user?.role ?? 'Care Giver'}</p>
        <p className="profile__id">ID No. {user?.staffId ?? 'not set'}</p>
      </div>

      <p className="list-group__label">Account</p>
      <Card className="stack-card" padded={false}>
        <Row
          icon="user"
          tint={TINTS.teal}
          label="Personal details"
          value={user?.name}
          onClick={() => navigate('/profile/details')}
        />
        {/* Availability is not surfaced here for now. The board still shows it,
            and /profile/availability is still routed and tested, so restoring
            this row is the only change needed to bring it back. */}
        <Row icon="settings" tint={TINTS.green} label="Preferences" onClick={() => navigate('/profile/preferences')} />
      </Card>

      <p className="list-group__label">Work</p>
      <Card className="stack-card" padded={false}>
        <Row icon="trend" tint={TINTS.purple} label="Weekly overview" onClick={() => navigate('/overview')} />
        <Row icon="bell" tint={TINTS.blue} label="Notifications" onClick={() => navigate('/notifications')} />
        <Row icon="send" tint={TINTS.teal} label="My requests" onClick={() => navigate('/profile/requests')} />
      </Card>

      <p className="list-group__label">App</p>
      <Card className="stack-card" padded={false}>
        <Row
          icon="moon"
          tint={TINTS.grey}
          label="Dark mode"
          trailing={<Switch on={dark} onChange={toggle} label="Dark mode" />}
        />
        {!installed && (
          <Row
            icon="download"
            tint={TINTS.teal}
            label="Install app"
            value={isIos ? 'Add to Home Screen' : ready ? undefined : 'How to'}
            onClick={handleInstall}
          />
        )}
        <Row icon="help" tint={TINTS.purple} label="Help and support" onClick={() => setSheet('help')} />
      </Card>

      <p className="list-group__label">Legal</p>
      <Card className="stack-card" padded={false}>
        <Row icon="file" label="Terms of use" onClick={() => setSheet('terms')} />
        <Row icon="shield" label="Privacy notice" onClick={() => setSheet('privacy')} />
      </Card>

      {/* Sign out is destructive: it clears the data held on this device. It is
          separated from the settings lists, coloured, and asks first. */}
      <Card className="stack-card stack-card--spaced" padded={false}>
        <Row icon="logout" label="Log out" danger onClick={() => setConfirmLogout(true)} />
      </Card>

      <div className="app-meta">
        <div className="app-meta__links">
          <button type="button" className="app-meta__link" onClick={() => setSheet('terms')}>
            Terms
          </button>
          <span className="app-meta__sep" aria-hidden="true">·</span>
          <button type="button" className="app-meta__link" onClick={() => setSheet('privacy')}>
            Privacy
          </button>
          <span className="app-meta__sep" aria-hidden="true">·</span>
          <button type="button" className="app-meta__link" onClick={() => setSheet('help')}>
            Help
          </button>
        </div>
        Best Pinnacle Care, version {__APP_VERSION__}
        <br />
        Signed in as {user?.email}
        <br />
        Developed by 9Sonic
      </div>

      <InfoSheet doc={sheet} onClose={() => setSheet(null)} />

      <InstallHelp
        open={iosHelp}
        onClose={() => setIosHelp(false)}
        isIos={isIos}
        supported={supported}
      />

      <EditProfileDialog
        open={editing}
        onClose={() => setEditing(false)}
        user={user}
        onSaved={setUser}
      />

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={logout}
        title="Log out?"
        icon="logout"
        destructive
        confirmLabel="Log out"
        message={
          pending > 0
            ? `You have ${pending} clock ${pending === 1 ? 'event' : 'events'} that have not reached the office yet. Logging out now will lose ${pending === 1 ? 'it' : 'them'}. Get a signal first if you can.`
            : 'Your visits and any saved data will be removed from this phone. You will need your password to sign back in.'
        }
      />
    </div>
  );
}
