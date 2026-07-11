import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AUTH_EXPIRED_EVENT, clearToken, getToken, setToken } from '../api/client';
import { authApi } from '../api/auth';
import { decodeJwt } from '../lib/format';
import type { LoginRequest } from '../api/types';

/**
 * The backend's login response only returns an access token (no profile), and
 * there's no "me" endpoint. We keep whatever profile hints we captured at
 * register/login time (email, and name if the user registered in this browser)
 * alongside the token so the sidebar can show something meaningful.
 */
interface Profile {
  email?: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
}

const PROFILE_KEY = 'idc.profile';

function loadProfile(): Profile {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveProfile(p: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

interface AuthContextValue {
  isAuthenticated: boolean;
  profile: Profile;
  login: (creds: LoginRequest) => Promise<void>;
  logout: () => void;
  /** Remember profile hints captured elsewhere (e.g. the register form). */
  rememberProfile: (p: Partial<Profile>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [profile, setProfile] = useState<Profile>(() => loadProfile());

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(PROFILE_KEY);
    setTokenState(null);
    setProfile({});
  }, []);

  // A 401 on any authenticated call clears the session globally.
  useEffect(() => {
    const onExpired = () => {
      setTokenState(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const rememberProfile = useCallback((p: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...p };
      saveProfile(next);
      return next;
    });
  }, []);

  const login = useCallback(async (creds: LoginRequest) => {
    const res = await authApi.login(creds);
    setToken(res.access_token);
    setTokenState(res.access_token);

    const claims = decodeJwt(res.access_token);
    const prev = loadProfile();
    const next: Profile = {
      ...prev,
      email: creds.email,
      userId: (claims?.sub as string) || prev.userId,
    };
    saveProfile(next);
    setProfile(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!token,
      profile,
      login,
      logout,
      rememberProfile,
    }),
    [token, profile, login, logout, rememberProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
