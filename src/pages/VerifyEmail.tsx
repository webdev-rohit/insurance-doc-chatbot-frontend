import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthAside } from '../components/AuthAside';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { authApi } from '../api/auth';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../api/client';

export function VerifyEmail() {
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation() as { state?: { token?: string; email?: string } };
  const [searchParams] = useSearchParams();

  // Token can arrive from the register flow (state), a query param (email link),
  // or be pasted by hand.
  const initialToken = location.state?.token || searchParams.get('token') || '';
  const email = location.state?.email;

  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setError('');
    if (!value.trim()) {
      setError('Paste the verification token from your email.');
      return;
    }
    setBusy(true);
    try {
      await authApi.verifyEmail(value.trim());
      setDone(true);
      toast.success('Email verified — you can sign in now.');
      setTimeout(() => navigate('/login', { state: { email } }), 1200);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Auto-verify if a token came in via a link, once.
  useEffect(() => {
    if (searchParams.get('token')) void submit(searchParams.get('token') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(token);
  };

  return (
    <div className="auth">
      <AuthAside
        heading="One last step."
        subheading="Confirm your email to activate your account. Login stays blocked until the account is verified."
      />

      <main className="auth__main">
        <div className="auth__card">
          <div className="dropzone__icon" style={{ margin: '0 0 20px' }}>✉️</div>
          <h1>Verify your email</h1>
          <p className="auth__sub">
            Paste the token from the verification email, or open the link we sent to confirm automatically.
          </p>

          {done ? (
            <Alert kind="success">Email verified! Redirecting you to sign in…</Alert>
          ) : (
            <>
              <Alert kind="error">{error}</Alert>
              <form onSubmit={onSubmit}>
                <div className="field">
                  <label className="label" htmlFor="token">Verification token</label>
                  <textarea
                    className="textarea"
                    id="token"
                    placeholder="Paste your verification token here…"
                    style={{ minHeight: 88, fontFamily: 'var(--mono)', fontSize: 13 }}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
                <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
                  {busy ? <Spinner /> : 'Verify email'}
                </button>
              </form>
            </>
          )}

          <p className="auth__alt">
            Wrong account? <Link to="/register">Register again</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
