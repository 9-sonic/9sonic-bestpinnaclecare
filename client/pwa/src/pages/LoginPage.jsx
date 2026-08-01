import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';
import WaveHeader from '../components/common/WaveHeader.jsx';
import { isSupported as passkeySupported } from '../api/webauthn.js';
import env from '../config/env.js';

// Sign in for carers. Three routes in: password, password plus a TOTP code when
// the account has it enabled, or a passkey which skips the password entirely.
export default function LoginPage() {
  const { login, submitMfa, cancelMfa, loginWithPasskey, mfaRequired, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(env.useMock ? 'carer@bestpinnacle.test' : '');
  const [password, setPassword] = useState(env.useMock ? 'secret12' : '');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/home';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await login({ email, password });
      // When a code is needed the screen swaps to the second step rather than
      // navigating, so nothing is lost if the carer mistypes it.
      if (!res.mfaRequired) navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitMfa(otp.trim());
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'That code was not accepted.');
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasskey() {
    setError('');
    if (!email) {
      setError('Enter your email address first, then use your passkey.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithPasskey(email);
      navigate(from, { replace: true });
    } catch (err) {
      if (err?.name === 'NotAllowedError') setError('That was cancelled.');
      else if (err?.status === 404) setError('No passkey is set up for this account on this device.');
      else setError(err.message || 'Passkey sign in is not available on this device.');
    } finally {
      setSubmitting(false);
    }
  }

  // Second step: the account has TOTP enabled.
  if (mfaRequired) {
    return (
      <div className="login">
        <WaveHeader height={140} />
        <div className="login__body">
          <h1 className="login__title">Enter your code</h1>
          <p className="login__subtitle">
            Open your authenticator app and enter the six digit code for Best Pinnacle Care.
          </p>

          <form onSubmit={handleOtp} className="form-stack">
            <label className="field">
              <span className="field__label">Six digit code</span>
              <input
                className="field__input otp-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                autoFocus
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <Button type="submit" size="lg" block disabled={submitting || otp.length < 6}>
              {submitting ? 'Checking' : 'Confirm'}
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
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <WaveHeader height={140} />

      <div className="login__body">
        <img src="/logo.png" alt="Best Pinnacle Care" className="login__logo" />
        <h1 className="login__title">Welcome Back!</h1>
        <p className="login__subtitle">Employee portal sign in</p>

        {env.useMock && (
          <p className="demo-note">
            <Icon name="info" size={14} />
            Demo mode. Any email and password will sign you in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span className="field__label">Email address</span>
            <span className="field__wrap">
              <input
                className="field__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                inputMode="email"
                placeholder="you@pinnaclecare.co.uk"
                required
              />
            </span>
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
                placeholder="Your password"
                required
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
              </button>
            </span>
          </label>

          <button
            type="button"
            className="link-right"
            onClick={() => navigate('/forgot-password')}
          >
            Forgot password?
          </button>

          {error && <p className="error-text">{error}</p>}

          <Button type="submit" size="lg" block disabled={submitting}>
            {submitting ? 'Signing in' : 'Sign In'}
          </Button>
        </form>

        {passkeySupported() && (
          <>
            <p className="login__divider">or sign in with biometric</p>
            <button
              type="button"
              className="biometric-btn"
              onClick={handlePasskey}
              disabled={submitting}
              aria-label="Sign in with a passkey"
              title="Face, fingerprint or device PIN"
            >
              <Icon name="fingerprint" size={28} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
