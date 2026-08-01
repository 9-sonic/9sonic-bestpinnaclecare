import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as apiFns from '../api/index.js';
import { setUnauthorizedHandler } from '../api/client.js';
import { getToken, setToken, clearToken } from '../utils/storage.js';

const AuthContext = createContext(null);

// Which admin roles may change staff and service user records. The server
// enforces this too; the UI uses it only to avoid showing controls that would
// be refused.
const MANAGING_ROLES = new Set(['registered_manager', 'manager', 'coordinator']);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaToken, setMfaToken] = useState(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setAdmin(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await apiFns.fetchCurrentAdmin();
        if (active) setAdmin(me);
      } catch {
        clearToken();
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await apiFns.login(credentials);
    if (res.mfa_required) {
      setMfaToken(res.mfa_token);
      return { mfaRequired: true };
    }
    setToken(res.access);
    setAdmin(res.admin ?? (await apiFns.fetchCurrentAdmin()));
    return { mfaRequired: false };
  }, []);

  const submitMfa = useCallback(
    async (otpCode) => {
      const res = await apiFns.completeMfa({ mfaToken, otpCode });
      setToken(res.access);
      setAdmin(res.admin ?? (await apiFns.fetchCurrentAdmin()));
      setMfaToken(null);
    },
    [mfaToken]
  );

  const logout = useCallback(async () => {
    try {
      await apiFns.logout();
    } catch {
      /* clear locally regardless */
    }
    clearToken();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({
      admin,
      loading,
      isAuthenticated: !!admin,
      mfaRequired: !!mfaToken,
      canManage: MANAGING_ROLES.has(admin?.role),
      isFinance: admin?.role === 'finance' || MANAGING_ROLES.has(admin?.role),
      login,
      submitMfa,
      cancelMfa: () => setMfaToken(null),
      logout,
    }),
    [admin, loading, mfaToken, login, submitMfa, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
