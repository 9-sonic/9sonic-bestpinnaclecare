import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WaveHeader from '../components/common/WaveHeader.jsx';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';
import { resetPassword } from '../api/auth.js';

// Set a password from a one-time email token. Accepting an invite and resetting
// a forgotten password are the same operation (PUT /staff/auth/password) —
// setting a password with an invite token is what marks the invite accepted,
// server-side. `mode` only changes the wording.
export default function SetPasswordPage({ mode = 'reset' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const copy = mode === 'invite'
    ? {
        title: 'Set your password',
        sub: 'Welcome to Best Pinnacle Care. Choose a password to finish setting up your account.',
        cta: 'Create account',
        doneTitle: 'Account ready',
      }
    : {
        title: 'Reset password',
        sub: 'Choose a new password for your account.',
        cta: 'Update password',
        doneTitle: 'Password updated',
      };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch {
      setError('That link is invalid or has expired. Ask the office to send a new one.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <WaveHeader height={120} />

      <div className="login__body">
        {!token ? (
          <div className="reset-done">
            <h1 className="login__title">Link not valid</h1>
            <p className="login__subtitle">
              This link is missing its token. Open the most recent email, or ask the office to send
              a new one.
            </p>
            <Button block size="lg" onClick={() => navigate('/login')}>
              Go to sign in
            </Button>
          </div>
        ) : done ? (
          <div className="reset-done">
            <span className="reset-done__icon">
              <Icon name="check" size={26} />
            </span>
            <h1 className="login__title">{copy.doneTitle}</h1>
            <p className="login__subtitle">You can now sign in with your new password.</p>
            <Button block size="lg" onClick={() => navigate('/login')}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-stack">
            <h1 className="login__title">{copy.title}</h1>
            <p className="login__subtitle">{copy.sub}</p>

            <label className="field">
              <span className="field__label">New password</span>
              <span className="field__wrap">
                <input
                  className={`field__input${error ? ' field__input--error' : ''}`}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="field__toggle"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  <Icon name={show ? 'eyeOff' : 'eye'} size={19} />
                </button>
              </span>
            </label>

            <label className="field">
              <span className="field__label">Confirm password</span>
              <input
                className={`field__input${error ? ' field__input--error' : ''}`}
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              {error && <span className="field__error">{error}</span>}
            </label>

            <span className="field__hint">At least 8 characters.</span>

            <Button type="submit" block size="lg" disabled={busy}>
              {busy ? 'Saving' : copy.cta}
            </Button>
            <Button variant="ghost" block onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
