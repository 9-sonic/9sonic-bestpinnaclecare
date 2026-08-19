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

const POINTS = [
  ['target', 'See who is on shift and who is late'],
  ['calendar', 'Build the rota and assign carers'],
  ['wallet', 'Review the visit-attendance record'],
];

const inputStyle = {
  ...s('height:48px;border-radius:16px;background:var(--d-field);padding:0 16px;font-size:14.5px;font-weight:500;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%;border:1.5px solid var(--d-border)'),
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

  return (
    <div style={{ ...s('min-height:100vh;background:var(--d-bg);display:flex;align-items:center;justify-content:center;padding:24px;position:relative'), fontFamily: "'Figtree', system-ui, -apple-system, sans-serif" }}>
      {/* Theme toggle */}
      <div onClick={toggle} className="hv" title={dark ? 'Switch to light' : 'Switch to dark'}
        style={{ ...s('position:absolute;top:22px;right:22px;width:44px;height:44px;border-radius:50%;background:var(--d-card);color:var(--d-ink2);display:flex;align-items:center;justify-content:center;cursor:pointer'), '--hbg': 'var(--d-card-hover)' }}>
        <Icon name={dark ? 'sun' : 'moon'} size={20} />
      </div>

      <div style={s('width:100%;max-width:940px;background:var(--d-card);border:1px solid var(--d-border);box-shadow:0 24px 60px rgba(2,6,23,0.10);border-radius:32px;overflow:hidden;display:flex;flex-wrap:wrap')}>
        {/* Brand panel */}
        <div style={s('flex:1 1 380px;min-width:300px;background:var(--d-panel);padding:40px 38px;display:flex;flex-direction:column;gap:28px')}>
          <div style={s('display:flex;align-items:center;gap:14px')}>
            <div style={s('width:52px;height:52px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;border:1px solid var(--d-border)')}>
              <img src="/logo.png" alt="" style={s('width:36px;height:36px;object-fit:contain')} />
            </div>
            <div style={s('display:flex;flex-direction:column;line-height:1.15')}>
              <span style={s('font-size:18px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>Best Pinnacle Care</span>
              <span style={s('font-size:13px;font-weight:600;color:var(--d-muted)')}>Office</span>
            </div>
          </div>

          <div style={s('font-size:15px;font-weight:500;color:var(--d-ink2);line-height:1.55')}>
            The live board, the rota and the week&apos;s hours. Sign in with your office account.
          </div>

          <div style={s('display:flex;flex-direction:column;gap:14px;margin-top:auto')}>
            {POINTS.map(([icon, label]) => (
              <div key={label} style={s('display:flex;align-items:center;gap:12px')}>
                <div style={s('width:38px;height:38px;border-radius:12px;background:var(--d-sage);display:flex;align-items:center;justify-content:center;flex:none;color:var(--d-ink2)')}><Icon name={icon} size={18} /></div>
                <span style={s('font-size:13.5px;font-weight:600;color:var(--d-ink2)')}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div style={s('flex:1 1 380px;min-width:300px;padding:40px 38px;display:flex;flex-direction:column;justify-content:center')}>
          {mfaRequired ? (
            <form onSubmit={handleOtp} style={s('display:flex;flex-direction:column;gap:18px')}>
              <div>
                <div style={s('font-size:24px;font-weight:700;color:var(--d-ink);letter-spacing:-0.5px')}>Enter your code</div>
                <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);line-height:1.5;margin-top:6px')}>Open your authenticator app and enter the six digit code for Best Pinnacle Care.</div>
              </div>

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
            <form onSubmit={handleForgot} style={s('display:flex;flex-direction:column;gap:18px')}>
              <div>
                <div style={s('font-size:24px;font-weight:700;color:var(--d-ink);letter-spacing:-0.5px')}>Reset your password</div>
                <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);line-height:1.5;margin-top:6px')}>Enter your work email and we&apos;ll send a link to set a new one.</div>
              </div>

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
            <form onSubmit={handleSubmit} style={s('display:flex;flex-direction:column;gap:18px')}>
              <div>
                <div style={s('font-size:24px;font-weight:700;color:var(--d-ink);letter-spacing:-0.5px')}>Sign in</div>
                <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);margin-top:6px')}>Office and management accounts only.</div>
              </div>

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

          <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);line-height:1.5;margin-top:24px')}>
            Carers use the separate mobile app. This site is for office staff.
          </div>
        </div>
      </div>
    </div>
  );
}
