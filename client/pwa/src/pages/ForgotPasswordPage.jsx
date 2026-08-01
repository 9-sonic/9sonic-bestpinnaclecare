import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WaveHeader from '../components/common/WaveHeader.jsx';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';

// Requests a reset link. Always reports the same result whether or not the
// address exists, so the screen cannot be used to discover who has an account.
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setError('');
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="login">
      <WaveHeader height={120} />

      <div className="login__body">
        {sent ? (
          <div className="reset-done">
            <span className="reset-done__icon">
              <Icon name="check" size={26} />
            </span>
            <h1 className="login__title">Check your email</h1>
            <p className="login__subtitle">
              If an account exists for {email}, we have sent a link to reset your password. The
              link expires in 30 minutes.
            </p>
            <Button block size="lg" onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-stack">
            <h1 className="login__title">Reset password</h1>
            <p className="login__subtitle">
              Enter the email address you use for work and we will send you a reset link.
            </p>

            <label className="field">
              <span className="field__label">Email address</span>
              <input
                className={`field__input${error ? ' field__input--error' : ''}`}
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pinnaclecare.co.uk"
              />
              {error && <span className="field__error">{error}</span>}
            </label>

            <Button type="submit" block size="lg" disabled={busy}>
              {busy ? 'Sending' : 'Send reset link'}
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
