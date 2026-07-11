import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthAside } from '../components/AuthAside';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Enter your email address.');
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(email);
      // The API returns the reset token directly — carry it to the reset screen.
      navigate('/reset-password', { state: { token: res.reset_token, email } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('No account found with that email.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <AuthAside
        heading="Forgot your password?"
        subheading="No problem. Enter your email and we’ll send you a token to reset it."
      />

      <main className="auth__main">
        <div className="auth__card">
          <h1>Reset your password</h1>
          <p className="auth__sub">We’ll email a reset token to your registered address.</p>

          <Alert kind="error">{error}</Alert>

          <form onSubmit={onSubmit}>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input className="input" id="email" type="email" autoComplete="email"
                placeholder="john.doe@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Send reset token'}
            </button>
          </form>

          <p className="auth__alt">
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
