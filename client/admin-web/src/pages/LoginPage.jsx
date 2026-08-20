import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { requestPasswordReset } from '../api/index.js';
import '../styles/design-shell.css';

// Office sign in. Separate from the carer app on purpose: this authenticates
// against the admins table, and most office accounts have TOTP turned on, so the
// second step is the normal path rather than an exception.

const inputStyle = {
  ...s('height:48px;border-radius:14px;background:var(--d-field);padding:0 16px;font-size:14.5px;font-weight:500;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%;border:1.5px solid var(--d-border)'),
  fontFamily: 'inherit',
};

function Field({ label, children }) {
  return (
    <label style={s('display:flex;flex-direction:column;gap:7px')}>
      <span style={s('font-size:12.5px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
      {children}
    </label>
  );
}

// The PWA's teal wave art (vector variant) — self-contained, no assets, so it
// scales to the card top on desktop.
function WaveArt() {
  return (
    <svg viewBox="0 0 390 210" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="adminWaveBase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0b5f6e" />
          <stop offset="55%" stopColor="#12a2b6" />
          <stop offset="100%" stopColor="#2ed3dd" />
        </linearGradient>
        <linearGradient id="adminWaveRibbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2ed3dd" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7ff0f5" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <path d="M0 0h390v128c-58 26-104 30-160 18C160 132 96 118 44 132 27 137 12 143 0 150z" fill="url(#adminWaveBase)" />
      <path d="M0 0c74 8 118 34 168 62 44 25 88 44 146 40 30-2 55-9 76-18V0z" fill="url(#adminWaveRibbon)" />
      <path d="M390 0v58c-40 14-79 12-118-4-30-13-56-33-84-54z" fill="#7ff0f5" opacity="0.22" />
    </svg>
  );
}

export default function LoginPage() {
  const { login, submitMfa, cancelMfa, mfaRequired, isAuthenticated } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

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

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await requestPasswordReset(email); } catch { /* never reveal whether the email exists */ }
    finally { setBusy(false); setSent(true); }
  }

  const primaryPill = (disabled) => ({
    ...s('height:50px;border-radius:25px;background:var(--d-pill);color:var(--d-pill-ink);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:700;cursor:pointer;width:100%;box-sizing:border-box;border:0'),
    fontFamily: 'inherit',
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  const hero = mfaRequired
    ? { title: 'Enter your code', subtitle: 'Two-step verification' }
    : forgot
      ? { title: 'Reset your password', subtitle: 'We’ll email you a link' }
      : { title: 'Welcome back', subtitle: 'Office Portal Sign In' };

  return (
    <div className="dlogin" style={{ position: 'relative', fontFamily: "'Plus Jakarta Sans', 'Figtree', system-ui, -apple-system, sans-serif" }}>
      {/* Theme toggle */}
      <div onClick={toggle} className="hv tip" data-tip={dark ? 'Switch to light' : 'Switch to dark'}
        style={{ ...s('position:absolute;top:22px;right:22px;width:44px;height:44px;border-radius:50%;background:var(--d-card);color:var(--d-ink2);display:flex;align-items:center;justify-content:center;cursor:pointer'), '--hbg': 'var(--d-card-hover)' }}>
        <Icon name={dark ? 'sun' : 'moon'} size={20} />
      </div>

      <div className="dlogin__card">
        {/* Wave header with the brand mark — mirrors the carer app. */}
        <div className="dlogin__wave">
          <WaveArt />
          <div className="dlogin__brand">
            <img src="/brand/logo-mono.webp" alt="" />
            <span className="dlogin__brand-name">Best Pinnacle Care · Office</span>
          </div>
        </div>

        <div className="dlogin__body">
          <div className="dlogin__title">{hero.title}</div>
          <div className="dlogin__subtitle">{hero.subtitle}</div>

          {mfaRequired ? (
            <form onSubmit={handleOtp} className="dlogin__form">
              <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);line-height:1.5;text-align:center')}>Open your authenticator app and enter the six digit code for Best Pinnacle Care.</div>

              <Field label="Six digit code">
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" autoFocus
                  style={{ ...inputStyle, height: '56px', fontSize: '24px', fontWeight: 700, letterSpacing: '0.4em', textAlign: 'center' }} />
              </Field>

              {error && <div style={s('font-size:13px;font-weight:600;color:var(--d-danger-ink)')}>{error}</div>}

              <button type="submit" disabled={busy || otp.length < 6} className="hv" style={{ ...primaryPill(busy || otp.length < 6), '--hbg': 'var(--d-pill-hover)' }}>{busy ? 'Checking…' : 'Confirm'}</button>
              <button type="button" onClick={() => { cancelMfa(); setOtp(''); setError(''); }}
                style={{ ...s('height:46px;border-radius:23px;background:transparent;color:var(--d-ink2);font-size:13.5px;font-weight:700;cursor:pointer;width:100%;border:0'), fontFamily: 'inherit' }}>
                Use a different account
              </button>
            </form>
          ) : forgot ? (
            <form onSubmit={handleForgot} className="dlogin__form">
              <div style={s('font-size:13px;font-weight:500;color:var(--d-muted);line-height:1.5;text-align:center')}>Enter your work email and we&apos;ll send a link to set a new one.</div>

              {sent ? (
                <div style={s('display:flex;align-items:center;gap:9px;background:var(--d-ok-bg);border-radius:14px;padding:12px 14px;font-size:12.5px;font-weight:600;color:var(--d-ok-ink)')}>
                  <Icon name="check" size={15} /> If that email has an account, a reset link is on its way.
                </div>
              ) : (
                <>
                  <Field label="Work email">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required style={inputStyle} />
                  </Field>
                  <button type="submit" disabled={busy || !email} className="hv" style={{ ...primaryPill(busy || !email), '--hbg': 'var(--d-pill-hover)' }}>{busy ? 'Sending…' : 'Send reset link'}</button>
                </>
              )}

              <button type="button" onClick={() => { setForgot(false); setSent(false); setError(''); }}
                style={{ ...s('height:46px;border-radius:23px;background:transparent;color:var(--d-ink2);font-size:13.5px;font-weight:700;cursor:pointer;width:100%;border:0'), fontFamily: 'inherit' }}>
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="dlogin__form">
              <Field label="Work email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required style={inputStyle} />
              </Field>

              <Field label="Password">
                <div style={s('position:relative;display:flex;align-items:center')}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required style={{ ...inputStyle, paddingRight: '48px' }} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ ...s('position:absolute;right:8px;width:36px;height:36px;border-radius:50%;background:transparent;color:var(--d-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;border:0'), fontFamily: 'inherit' }}>
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                </div>
              </Field>

              <div style={s('display:flex;justify-content:flex-end;margin-top:-8px')}>
                <button type="button" onClick={() => { setForgot(true); setError(''); }}
                  style={{ ...s('background:transparent;border:0;cursor:pointer;font-size:12.5px;font-weight:700;color:var(--d-primary)'), fontFamily: 'inherit' }}>
                  Forgot password?
                </button>
              </div>

              {error && <div style={s('font-size:13px;font-weight:600;color:var(--d-danger-ink)')}>{error}</div>}

              <button type="submit" disabled={busy} className="hv" style={{ ...primaryPill(busy), '--hbg': 'var(--d-pill-hover)' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
