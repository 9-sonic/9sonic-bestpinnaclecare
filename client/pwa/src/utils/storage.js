// Small, safe wrapper around localStorage.
// Isolating storage access here means we can swap the mechanism later
// (e.g. move the auth token to an httpOnly cookie set by Rails) without
// touching the rest of the app.

const TOKEN_KEY = 'bpc.auth.token';
const REFRESH_KEY = 'bpc.auth.refresh';
const EXPIRES_KEY = 'bpc.auth.expires';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable (private mode etc.) - ignore */
  }
}

export function getToken() {
  return read(TOKEN_KEY);
}

export function setToken(token) {
  write(TOKEN_KEY, token);
}

// The refresh token used by POST /api/v1/auth/refresh. It rotates on every
// use — the server revokes the old one — so whatever comes back must replace
// what is stored here. Presenting a revoked token kills the whole chain.
export function getRefreshToken() {
  return read(REFRESH_KEY);
}

export function setRefreshToken(token) {
  write(REFRESH_KEY, token);
}

// When the access token expires, ISO string. Only the refresh endpoint returns
// it today, so a missing value means "unknown" and the client refreshes
// reactively on a 401 instead of ahead of time.
export function getTokenExpiry() {
  return read(EXPIRES_KEY);
}

export function setTokenExpiry(iso) {
  write(EXPIRES_KEY, iso);
}

// Everything the session owns, cleared together. A carer signing out must not
// leave a refresh token behind that would quietly resurrect the session.
export function clearToken() {
  setToken(null);
  setRefreshToken(null);
  setTokenExpiry(null);
}
