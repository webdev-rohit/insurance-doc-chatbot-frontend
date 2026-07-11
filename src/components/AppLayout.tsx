import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../lib/format';

/** The dark-sidebar app shell used by the Documents and Chat screens. */
export function AppLayout() {
  const { profile, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const name = fullName || profile.email || 'Signed in';
  const showEmailLine = Boolean(fullName && profile.email);

  const onLogout = () => {
    logout();
    toast.info('Signed out.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink className="brand" to="/chat">
          <span className="brand__logo">🛡️</span>
          <span>
            Insurance Bot<small>Workspace</small>
          </span>
        </NavLink>

        <nav className="nav">
          <NavLink
            to="/chat"
            className={({ isActive }) => `nav__item${isActive ? ' nav__item--active' : ''}`}
          >
            <span className="nav__icon">💬</span> Chat
          </NavLink>
          <NavLink
            to="/documents"
            className={({ isActive }) => `nav__item${isActive ? ' nav__item--active' : ''}`}
          >
            <span className="nav__icon">📄</span> Documents
          </NavLink>
        </nav>

        <div className="sidebar__spacer" />

        <div className="sidebar__user">
          <span className="avatar">{initials(profile.firstName, profile.lastName, profile.email)}</span>
          <div className="meta">
            <strong>{name}</strong>
            {showEmailLine && <span>{profile.email}</span>}
          </div>
          <button
            className="btn btn--icon btn--subtle"
            title="Log out"
            style={{ background: 'transparent', color: '#8e8ea0' }}
            onClick={onLogout}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <Outlet />
    </div>
  );
}
