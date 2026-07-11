import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthAside } from '../components/AuthAside';
import { PasswordInput } from '../components/PasswordInput';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

const NAME_RE = /^[A-Za-z\s'-]{1,100}$/;
const PW_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function Register() {
  const navigate = useNavigate();
  const { rememberProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = (): string | null => {
    if (!NAME_RE.test(firstName)) return 'First name: letters, spaces, hyphens or apostrophes only (1–100 chars).';
    if (!NAME_RE.test(lastName)) return 'Last name: letters, spaces, hyphens or apostrophes only (1–100 chars).';
    if (!email) return 'Enter your email address.';
    if (!PW_RE.test(password)) return 'Password must be at least 8 characters and include a letter and a number.';
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.register({
        email,
        first_name: firstName,
        last_name: lastName,
        password,
      });
      // Keep the name for the sidebar once they eventually sign in.
      rememberProfile({ email, firstName, lastName });
      // The API returns the verify token directly — hand it to the verify screen.
      navigate('/verify-email', { state: { token: res.verify_token, email } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError('That email is already registered. Try signing in instead.');
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
        heading="Create your account."
        subheading="Get started in seconds. We’ll email you a verification link to activate your account."
        features={['Free to start', 'Your documents stay private to you', 'Cancel anytime']}
      />

      <main className="auth__main">
        <div className="auth__card">
          <h1>Create account</h1>
          <p className="auth__sub">Enter your details to get started.</p>

          <Alert kind="error">{error}</Alert>

          <form onSubmit={onSubmit}>
            <div className="row gap-12">
              <div className="field grow">
                <label className="label" htmlFor="first">First name</label>
                <input className="input" id="first" type="text" placeholder="John"
                  value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="field grow">
                <label className="label" htmlFor="last">Last name</label>
                <input className="input" id="last" type="text" placeholder="Doe"
                  value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <p className="hint" style={{ marginTop: -8, marginBottom: 18 }}>
              Letters, spaces, hyphens or apostrophes only · 1–100 chars.
            </p>

            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input className="input" id="email" type="email" autoComplete="email"
                placeholder="john.doe@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <PasswordInput id="password" value={password} onChange={setPassword}
                autoComplete="new-password" placeholder="Create a password" />
              <p className="hint">At least 8 characters, including one letter and one number.</p>
            </div>

            <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Create account'}
            </button>
          </form>

          <div className="auth__divider">then</div>
          <p className="text-sm text-muted" style={{ textAlign: 'center' }}>
            We’ll email you a verification link to activate your account.
          </p>

          <p className="auth__alt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
