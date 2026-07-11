import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Auth screens redirect into the app if the user is already signed in. */
export function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/chat" replace />;
  return <Outlet />;
}
