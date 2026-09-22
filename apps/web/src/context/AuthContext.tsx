/**
 * AuthContext — provides the current authenticated user to the whole app.
 *
 * On mount, calls GET /api/auth/me to restore the session from the HttpOnly
 * cookie (if one exists). Components consume useAuth() to get the user and
 * the login/logout helpers.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { UserSummary, LoginRequest } from '@school/shared';
import { authApi } from '../api/auth.js';

interface AuthContextValue {
  /** Null while loading, undefined if not authenticated, UserSummary if authenticated */
  user: UserSummary | null | undefined;
  /** True during the initial session-restore check */
  loading: boolean;
  login: (req: LoginRequest) => Promise<string | null>; // returns error string or null
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    authApi.me().then((res) => {
      setUser(res.success && res.data ? res.data.user : null);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (req: LoginRequest): Promise<string | null> => {
    const res = await authApi.login(req);
    if (res.success && res.data) {
      setUser(res.data.user);
      return null;
    }
    return res.error ?? 'Login failed';
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
