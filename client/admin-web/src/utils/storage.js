// Token storage for the office app.
//
// Deliberately a different key from the carer app: the two use different
// identities against the same API, and a manager signing in on a shared office
// machine should not inherit or clobber a carer session left in the browser.

const TOKEN_KEY = 'bpc.admin.token';

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
    /* private mode */
  }
}

export function clearToken() {
  setToken(null);
}
