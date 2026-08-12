import env from '../config/env.js';
import { getToken, clearToken } from '../utils/storage.js';

// HTTP client for the office app. Same contract as the carer app: bearer token,
// snake_case error codes in { error, details }.

export class ApiError extends Error {
  constructor(message, { status, code, details, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.data = data;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

const MESSAGES = {
  invalid_credentials: 'Those details did not match. Check the email and password.',
  not_found: 'We could not find that.',
  validation_failed: 'Some details need fixing.',
  parameter_missing: 'Something was missing from that request.',
  conflict: 'That already exists.',
  forbidden: 'Your role does not allow that.',
  unauthorized: 'Your session has expired. Please sign in again.',
  carer_unavailable: 'That carer is already booked on an overlapping visit.',
  already_assigned: 'That carer is already on this visit.',
  unconfirmed_lines: 'This carer has visits still in review — resolve those before approving.',
  period_locked: 'This period is locked, so it can no longer be changed.',
  no_lines: 'This carer has no timesheet lines in this period.',
};

function messageFor(code, status) {
  if (MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return MESSAGES.unauthorized;
  if (status === 403) return MESSAGES.forbidden;
  if (status >= 500) return 'The server had a problem. Please try again.';
  return 'Something went wrong.';
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, { method = 'GET', body, headers = {}, signal, auth = true } = {}) {
  const token = auth ? getToken() : null;

  let response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...(token ? { Authorization: `Bearer ${token}` } : null),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('Cannot reach the server. Check your connection.', { status: 0 });
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') return null;

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
