import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.js';
import { setUnauthorizedHandler } from '../api/client.js';
import { getToken, setToken, clearToken } from '../utils/storage.js';

// Holds the signed-in carer and the actions that change who that is.
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when the account has TOTP and login needs a second step.
  const [mfaToken, setMfaToken] = useState(null);

  // The API rejects an expired or revoked token with a 401. The client clears
  // the stored token when that happens; this drops the user object too, so the
  // route guard sends the carer back to sign in instead of leaving them on a
  // screen that can no longer load anything.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    let active = true;
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.fetchCurrentUser();
        if (active) setUser(me);
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

  // Returns { mfaRequired: true } when a code is needed, so the screen can show
  // the second step rather than assuming the sign in succeeded.
  const login = useCallback(async (credentials) => {
    const res = await authApi.login(credentials);

    if (res.mfaRequired) {
      setMfaToken(res.mfaToken);
      return { mfaRequired: true };
    }

    setToken(res.token);
    setUser(res.user ?? (await authApi.fetchCurrentUser()));
    return { mfaRequired: false };
  }, []);

  const submitMfa = useCallback(
    async (otpCode) => {
      const res = await authApi.completeMfa({ mfaToken, otpCode });
      setToken(res.token);
      setUser(res.user ?? (await authApi.fetchCurrentUser()));
      setMfaToken(null);
    },
    [mfaToken]
  );

  const cancelMfa = useCallback(() => setMfaToken(null), []);

  // Signs in with a passkey, which skips the password entirely.
  const loginWithPasskey = useCallback(async (email) => {
    const { loginWithPasskey: run } = await import('../api/webauthn.js');
    const res = await run(email);
    setToken(res.token);
    setUser(res.user ?? (await authApi.fetchCurrentUser()));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the token is cleared locally either way */
    }
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      isAuthenticated: !!user,
      mfaRequired: !!mfaToken,
      login,
      submitMfa,
      cancelMfa,
      loginWithPasskey,
      logout,
    }),
    [user, loading, mfaToken, login, submitMfa, cancelMfa, loginWithPasskey, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
