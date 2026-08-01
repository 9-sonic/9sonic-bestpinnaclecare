import env from '../config/env.js';
import { getToken, clearToken } from '../utils/storage.js';

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

async function request(path, { method = 'GET', body, headers = {}, signal, auth = true } = {}) {
  const token = auth ? getToken() : null;

  const finalHeaders = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
    ...(token ? { Authorization: `Bearer ${token}` } : null),
    ...headers,
  };

  let response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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

  if (!response.ok) {
    const code = data?.error;

    if (response.status === 401) {
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
