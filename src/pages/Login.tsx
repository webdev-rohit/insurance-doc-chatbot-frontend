import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthAside } from '../components/AuthAside';
import { PasswordInput } from '../components/PasswordInput';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string }; email?: string } };
  const redirectTo = location.state?.from?.pathname || '/chat';

  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNotice('Your email isn’t verified yet. Please verify it before signing in.');
      } else if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Invalid email or password.' : err.message);
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
        heading="Ask your policy anything."
        subheading="Upload an insurance document and get accurate, cited answers powered by retrieval-augmented generation."
        features={[
          'Answers grounded strictly in your uploaded PDFs',
          'Understands tables, clauses and definitions',
          'Every response reports its token usage',
        ]}
      />

      <main className="auth__main">
        <div className="auth__card">
          <h1>Welcome back</h1>
          <p className="auth__sub">Sign in to continue to your workspace.</p>

          <Alert kind="error">{error}</Alert>
          {notice && (
            <Alert kind="info">
              {notice} <Link to="/verify-email">Verify now →</Link>
            </Alert>
          )}

          <form onSubmit={onSubmit}>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                type="email"
                autoComplete="email"
                placeholder="john.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <div className="row between">
                <label className="label" htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                <Link className="text-sm" to="/forgot-password">Forgot password?</Link>
              </div>
              <div style={{ marginTop: 7 }}>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Sign in'}
            </button>
          </form>

          <p className="auth__alt">
            Don’t have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
