import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';
import env from '../config/env.js';

// Office sign in.
//
// Separate from the carer app on purpose: this authenticates against the
// admins table, and most office accounts have TOTP turned on, so the second
// step is the normal path rather than an exception.
export default function LoginPage() {
  const { login, submitMfa, cancelMfa, mfaRequired, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(env.useMock ? 'reg.manager@bestpinnacle.test' : '');
  const [password, setPassword] = useState(env.useMock ? 'secret12' : '');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await login({ email, password });
      if (!res.mfaRequired) navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await submitMfa(otp.trim());
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'That code was not accepted.');
      setOtp('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__brand">
          <img src="/logo.png" alt="" className="auth__logo" />
          <span>
            Best Pinnacle Care
            <b>Office</b>
          </span>
        </div>

        <p className="auth__blurb">
          The live board, the rota and the week's hours. Sign in with your office account.
        </p>

        <ul className="auth__points">
          <li>
            <Icon name="target" size={16} /> See who is on shift and who is late
          </li>
          <li>
            <Icon name="calendar" size={16} /> Build the rota and assign carers
          </li>
          <li>
            <Icon name="wallet" size={16} /> Check and approve timesheets
          </li>
        </ul>
      </div>

      <div className="auth__form-side">
        <div className="auth__card">
          {mfaRequired ? (
            <form onSubmit={handleOtp}>
              <h1 className="auth__title">Enter your code</h1>
              <p className="auth__sub">
                Open your authenticator app and enter the six digit code for Best Pinnacle Care.
              </p>

              <label className="field">
                <span className="field__label">Six digit code</span>
                <input
                  className="field__input otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </label>

              {error && <p className="error-text">{error}</p>}

              <Button type="submit" size="lg" block loading={busy} disabled={otp.length < 6}>
                Confirm
              </Button>
              <Button
                variant="ghost"
                block
                onClick={() => {
                  cancelMfa();
                  setOtp('');
                  setError('');
                }}
              >
                Use a different account
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="auth__title">Sign in</h1>
              <p className="auth__sub">Office and management accounts only.</p>

              {env.useMock && (
                <p className="demo-note">
                  <Icon name="info" size={14} />
                  Demo mode. Any details work, and the code step accepts anything.
                </p>
              )}

              <label className="field">
                <span className="field__label">Work email</span>
                <input
                  className="field__input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              <label className="field">
                <span className="field__label">Password</span>
                <span className="field__wrap">
                  <input
                    className="field__input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="field__toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                </span>
              </label>

              {error && <p className="error-text">{error}</p>}

              <Button type="submit" size="lg" block loading={busy}>
                Sign in
              </Button>
            </form>
          )}

          <p className="auth__foot">
            Carers use the separate mobile app. This site is for office staff.
          </p>
        </div>
      </div>
    </div>
  );
}
