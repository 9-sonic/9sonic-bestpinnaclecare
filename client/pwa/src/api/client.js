import env from '../config/env.js';
import {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  setTokenExpiry,
} from '../utils/storage.js';

// ---------------------------------------------------------------------------
// HTTP client for the Best Pinnacle Care Rails API.
//
// Every request goes through here so the base URL, bearer token, JSON handling
// and error shape live in one place.
//
// The API returns errors as { error: "some_code", details: {...} } with the
// code in snake_case. We keep the raw code on the error for logic to branch on
// and turn it into a sentence for the UI.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(message, { status, code, details, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.data = data;
  }

  // True when the request never reached the server (offline, DNS, CORS).
  get isNetworkError() {
    return this.status === 0;
  }
}

// Error codes the API returns, mapped to something a carer can act on.
const MESSAGES = {
  invalid_credentials: 'Those details did not match. Check your email and password.',
  not_found: 'We could not find that.',
  validation_failed: 'Some details need fixing.',
  parameter_missing: 'Something was missing from that request.',
  conflict: 'That has already been recorded.',
  too_far: 'You are too far from the address to clock in.',
  forbidden: 'You do not have permission to do that.',
  unauthorized: 'Your session has expired. Please sign in again.',
  too_large: 'That image is too large (max 5 MB).',
  unsupported_type: 'Please choose a PNG, JPG, WEBP or GIF.',
};

function messageFor(code, status) {
  if (MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return MESSAGES.unauthorized;
  if (status === 403) return MESSAGES.forbidden;
  if (status >= 500) return 'The server had a problem. Please try again.';
  return 'Something went wrong.';
}

// Set by the auth layer so a rejected token can bounce the app to sign in.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// ---------------------------------------------------------------------------
// Token refresh.
//
// A carer opens the app at 07:00 and works until 20:00, mostly with the screen
// locked. If the access token expires mid-round, bouncing them to a sign-in
// screen on someone's doorstep takes the outbox with it. So a 401 is treated as
// "try once to get a new token", and only a failed refresh signs them out.
//
// Single-flight: a screen that fires four requests at once must not send four
// refreshes. The first caller does the work and the rest await the same promise.
// This matters more than usual here because the server rotates the token on
// every use — a second refresh with the old token would look like a stolen
// token and revoke the entire chain.
//
// Staff login does return a refresh token (the server's render_access sends
// access, access_expires_at and refresh_token together), and auth.js stores it,
// so this path is live rather than dormant. An earlier comment here claimed the
// opposite long after the server had been fixed.
// ---------------------------------------------------------------------------
let refreshInFlight = null;

async function refreshAccessToken() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      });
      if (!res.ok) return false;

      const data = await res.json().catch(() => null);
      if (!data?.access) return false;

      setToken(data.access);
      // Rotated: store the new one or the next refresh presents a revoked token.
      if (data.refresh_token) setRefreshToken(data.refresh_token);
      if (data.access_expires_at) setTokenExpiry(data.access_expires_at);
      return true;
    } catch {
      // Offline during a refresh is not an expired session. Report failure so
      // the original request surfaces its own network error.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request(
  path,
  { method = 'GET', body, headers = {}, signal, auth = true, _retried = false } = {}
) {
  const token = auth ? getToken() : null;

  // No base URL and not in mock mode means every path below would be requested
  // relative to the app's own origin. A static host answers an unknown path
  // with index.html and a 200, so the response would parse as "no data" rather
  // than as a failure, and the carer would get empty screens with no error —
  // the app looking calm and knowing nothing. Fail here instead.
  if (!env.apiBaseUrl) {
    throw new ApiError('This app is not configured to reach the care system yet.', {
      status: 0,
      code: 'api_base_url_missing',
    });
  }

  // FormData goes up as-is. Setting Content-Type by hand would drop the
  // multipart boundary the browser generates, and the server would read the
  // upload as an empty body — so the header is deliberately left off and
  // fetch fills it in.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const finalHeaders = {
    Accept: 'application/json',
    ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : null),
    ...(token ? { Authorization: `Bearer ${token}` } : null),
    ...headers,
  };

  let response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // Tell a deliberate abort apart from a genuine connectivity failure.
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('No connection. Check your signal and try again.', { status: 0 });
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  // A successful response that is not JSON is not a successful response. This
  // is what a misrouted request looks like: the web server returns the app's
  // own index.html with a 200, and without this the screen would treat an HTML
  // page as an empty result and show nothing at all.
  if (response.ok && !isJson) {
    throw new ApiError('The care system sent something unexpected. Please try again.', {
      status: response.status,
      code: 'unexpected_response',
    });
  }

  if (!response.ok) {
    const code = data?.error;

    if (response.status === 401 && auth) {
      // One attempt at a new access token before giving up on the session.
      if (!_retried && (await refreshAccessToken())) {
        return request(path, { method, body, headers, signal, auth, _retried: true });
      }
      clearToken();
      onUnauthorized?.();
    }

    throw new ApiError(messageFor(code, response.status), {
      status: response.status,
      code,
      details: data?.details,
      data,
    });
  }

  return data;
}

function withQuery(path, params) {
  const entries = Object.entries(params ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return path;
  return `${path}?${new URLSearchParams(entries).toString()}`;
}

export const api = {
  get: (path, params, opts) => request(withQuery(path, params), { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

export default api;
