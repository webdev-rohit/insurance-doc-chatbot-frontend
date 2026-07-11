import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthAside } from '../components/AuthAside';
import { PasswordInput } from '../components/PasswordInput';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { authApi } from '../api/auth';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../api/client';

const PW_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation() as { state?: { token?: string; email?: string } };
  const [searchParams] = useSearchParams();

  const [token, setToken] = useState(location.state?.token || searchParams.get('token') || '');
  const email = location.state?.email;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError('Paste the reset token from your email.');
      return;
    }
    if (!PW_RE.test(password)) {
      setError('Password must be at least 8 characters and include a letter and a number.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      toast.success('Password updated — sign in with your new password.');
      navigate('/login', { state: { email } });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <AuthAside
        heading="Set a new password."
        subheading="Choose a strong password you don’t use anywhere else."
      />

      <main className="auth__main">
        <div className="auth__card">
          <h1>Choose a new password</h1>
          <p className="auth__sub">Enter the token from your email and your new password.</p>

          <Alert kind="error">{error}</Alert>

          <form onSubmit={onSubmit}>
            <div className="field">
              <label className="label" htmlFor="token">Reset token</label>
              <textarea
                className="textarea"
                id="token"
                placeholder="Paste your reset token here…"
                style={{ minHeight: 78, fontFamily: 'var(--mono)', fontSize: 13 }}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">New password</label>
              <PasswordInput id="password" value={password} onChange={setPassword}
                autoComplete="new-password" placeholder="New password" />
              <p className="hint">
                At least 8 characters, including one letter and one number. Cannot match your old password.
              </p>
            </div>

            <div className="field">
              <label className="label" htmlFor="confirm">Confirm new password</label>
              <PasswordInput id="confirm" value={confirm} onChange={setConfirm}
                autoComplete="new-password" placeholder="Re-enter new password"
                invalid={confirm.length > 0 && confirm !== password} />
            </div>

            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Update password'}
            </button>
          </form>

          <p className="auth__alt">
            Back to <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
