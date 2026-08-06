import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useBiometric } from '../hooks/useBiometric.js';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';
import WaveHeader from '../components/common/WaveHeader.jsx';
import env from '../config/env.js';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const biometric = useBiometric();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(env.useMock ? 'carer@bestpinnacle.test' : '');
  const [password, setPassword] = useState(env.useMock ? 'secret12' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/home';

  // Redirecting during render is a side effect, so it waits for an effect.
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBiometric() {
    setError('');
    setSubmitting(true);
    try {
      if (!biometric.enrolled) await biometric.enroll({ id: 'carer-1', email, name: 'Carer' });
      else await biometric.authenticate();
      await login({ email, password: '' });
      navigate(from, { replace: true });
    } catch (err) {
      if (err?.name === 'NotAllowedError') setError('Biometric sign in was cancelled.');
      else setError('Biometric sign in is not available on this device.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signin">
      <WaveHeader height={210} />

      <div className="signin__body">
        <header className="signin__intro">
          <h1 className="signin__title">Welcome Back!</h1>
          <p className="signin__subtitle">Employee Portal Sign In</p>
        </header>

        {env.useMock && (
          <p className="demo-note">
            <Icon name="info" size={14} />
            Demo mode. Any email and password will sign you in.
          </p>
        )}

        <form onSubmit={handleSubmit} className="signin__form">
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="field__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
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
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} />
              </button>
            </span>
          </label>

          <button
            type="button"
            className="signin__forgot"
            onClick={() => navigate('/forgot-password')}
          >
            Forgot Password
          </button>

          {error && <p className="error-text">{error}</p>}

          <Button type="submit" size="lg" block loading={submitting}>
            Sign In
          </Button>
        </form>

        <p className="signin__divider">Or Sign in with biometric</p>

        <button
          type="button"
          className="signin__biometric"
          onClick={handleBiometric}
          disabled={submitting}
          aria-label="Sign in with a passkey"
          title={
            biometric.supported
              ? 'Face, fingerprint or device PIN'
              : 'No biometric sensor detected on this device'
          }
        >
          <Icon name="fingerprint" size={40} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
