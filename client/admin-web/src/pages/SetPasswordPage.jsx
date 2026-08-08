import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { setPassword as apiSetPassword } from '../api/index.js';
import '../styles/design-shell.css';

// Accept-invite and reset-password are the same operation: set a password with a
// one-time token from the email link (PUT /admin/auth/password). Setting a
// password via an invite token is what marks the invite accepted, server-side.
// The route only changes the wording.

const inputStyle = {
  ...s('height:48px;border-radius:16px;background:var(--d-field);padding:0 16px;font-size:14.5px;font-weight:500;color:var(--d-ink);outline:none;box-sizing:border-box;width:100%;border:1.5px solid transparent'),
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

const primaryPill = (disabled) => ({
  ...s('height:50px;border-radius:25px;background:var(--d-pill);color:var(--d-pill-ink);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:700;width:100%;box-sizing:border-box;border:0'),
  fontFamily: 'inherit',
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const ghostBtn = {
  ...s('height:46px;border-radius:23px;background:transparent;color:var(--d-ink2);font-size:13.5px;font-weight:700;cursor:pointer;width:100%;border:0'),
  fontFamily: 'inherit',
};

export default function SetPasswordPage({ mode = 'reset' }) {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const copy = mode === 'invite'
    ? { title: 'Set your password', sub: 'Welcome to Best Pinnacle Care. Choose a password to finish setting up your office account.', cta: 'Create account' }
    : { title: 'Reset your password', sub: 'Choose a new password for your office account.', cta: 'Update password' };

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await apiSetPassword({ token, password });
      setDone(true);
    } catch {
      setError('That link is invalid or has expired. Ask an office manager to send a new one.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...s('min-height:100vh;background:var(--d-bg);display:flex;align-items:center;justify-content:center;padding:24px;position:relative'), fontFamily: "'Figtree', system-ui, -apple-system, sans-serif" }}>
      <div onClick={toggle} className="hv" title={dark ? 'Switch to light' : 'Switch to dark'}
        style={{ ...s('position:absolute;top:22px;right:22px;width:44px;height:44px;border-radius:50%;background:var(--d-card);color:var(--d-ink2);display:flex;align-items:center;justify-content:center;cursor:pointer'), '--hbg': 'var(--d-card-hover)' }}>
        <Icon name={dark ? 'sun' : 'moon'} size={20} />
      </div>

      <div style={s('width:100%;max-width:440px;background:var(--d-card);border-radius:28px;padding:40px 36px;display:flex;flex-direction:column;gap:22px')}>
        <div style={s('display:flex;align-items:center;gap:13px')}>
          <div style={s('width:48px;height:48px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;border:1px solid var(--d-border)')}>
            <img src="/logo.png" alt="" style={s('width:32px;height:32px;object-fit:contain')} />
          </div>
          <div style={s('display:flex;flex-direction:column;line-height:1.15')}>
            <span style={s('font-size:16px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>Best Pinnacle Care</span>
            <span style={s('font-size:12.5px;font-weight:600;color:var(--d-muted)')}>Office</span>
          </div>
        </div>

        {!token ? (
          <div style={s('display:flex;flex-direction:column;gap:16px')}>
            <div>
              <div style={s('font-size:22px;font-weight:700;color:var(--d-ink);letter-spacing:-0.5px')}>Link not valid</div>
              <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);line-height:1.5;margin-top:6px')}>This link is missing its token. Open the most recent email, or ask an office manager to send a new invite.</div>
            </div>
            <button type="button" onClick={() => navigate('/login')} className="hv" style={{ ...primaryPill(false), '--hbg': 'var(--d-pill-hover)' }}>Go to sign in</button>
          </div>
        ) : done ? (
          <div style={s('display:flex;flex-direction:column;gap:16px')}>
            <div style={s('width:52px;height:52px;border-radius:50%;background:var(--d-ok-bg);color:var(--d-ok-ink);display:flex;align-items:center;justify-content:center')}><Icon name="check" size={26} /></div>
            <div>
              <div style={s('font-size:22px;font-weight:700;color:var(--d-ink);letter-spacing:-0.5px')}>{mode === 'invite' ? 'Account ready' : 'Password updated'}</div>
              <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);line-height:1.5;margin-top:6px')}>You can now sign in with your new password.</div>
            </div>
            <button type="button" onClick={() => navigate('/login')} className="hv" style={{ ...primaryPill(false), '--hbg': 'var(--d-pill-hover)' }}>Go to sign in</button>
          </div>
        ) : (
          <form onSubmit={submit} style={s('display:flex;flex-direction:column;gap:18px')}>
            <div>
              <div style={s('font-size:24px;font-weight:700;color:var(--d-ink);letter-spacing:-0.5px')}>{copy.title}</div>
              <div style={s('font-size:13.5px;font-weight:500;color:var(--d-muted);line-height:1.5;margin-top:6px')}>{copy.sub}</div>
            </div>

            <Field label="New password">
              <div style={s('position:relative;display:flex;align-items:center')}>
                <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" required autoFocus style={{ ...inputStyle, paddingRight: '48px' }} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                  style={{ ...s('position:absolute;right:8px;width:36px;height:36px;border-radius:50%;background:transparent;color:var(--d-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;border:0'), fontFamily: 'inherit' }}>
                  <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
            </Field>

            <Field label="Confirm password">
              <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required style={inputStyle} />
            </Field>

            <div style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>At least 8 characters.</div>

            {error && <div style={s('font-size:13px;font-weight:600;color:var(--d-danger-ink)')}>{error}</div>}

            <button type="submit" disabled={busy} className="hv" style={{ ...primaryPill(busy), '--hbg': 'var(--d-pill-hover)' }}>{busy ? 'Saving…' : copy.cta}</button>
            <button type="button" onClick={() => navigate('/login')} style={ghostBtn}>Back to sign in</button>
          </form>
        )}
      </div>
    </div>
  );
}
