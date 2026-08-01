// Small, safe wrapper around localStorage.
// Isolating storage access here means we can swap the mechanism later
// (e.g. move the auth token to an httpOnly cookie set by Rails) without
// touching the rest of the app.

const TOKEN_KEY = 'bpc.auth.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode etc.) - ignore */
  }
}

export function clearToken() {
  setToken(null);
}
