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
  already_assigned: 'That carer is already on this visit.',
  unconfirmed_lines: 'This carer has visits still in review — resolve those before approving.',
  period_locked: 'This period is locked, so it can no longer be changed.',
  no_lines: 'This carer has no timesheet lines in this period.',
  cannot_deactivate_self: 'You cannot deactivate your own account.',
  last_registered_manager: 'You cannot remove the last registered manager — the system must keep one.',
  visit_in_past: "You can't create or publish a visit in the past.",
  visit_already_filled: 'That visit has already been filled by another carer.',
  visit_started: "This visit can't be cancelled — a carer has already clocked in. The record must be kept.",
  already_cancelled: 'This visit is already cancelled.',
  reason_required: 'A reason is required — it goes in the audit trail.',
  minimum_duration_not_met: 'A carer cannot clock out within 2 minutes of clocking in.',

  // Scheduling
  client_overlap: 'This client already has a visit at that time — one client, one visit at a time. Pick a different time, or cancel the existing visit first.',
  client_unavailable: 'This client already has a carer on an overlapping visit — one client, one carer at a time.',
  visit_cancelled: 'This visit is cancelled, so it can no longer be published or changed.',
  visit_has_records: "This visit can't be deleted — a carer has already clocked in, so the record must be kept. Cancel it instead.",
  invalid_visit_assignment: 'That visit assignment could not be found.',

  // Sign-in, two-step and password reset
  invalid_code: 'That code is incorrect. Check your authenticator app and try again.',
  invalid_mfa_token: 'That two-step request has expired. Sign in again to get a new code.',
  invalid_refresh_token: 'Your session has expired. Please sign in again.',
  challenge_expired: 'That took too long — please try again.',
  authentication_failed: "That didn't work. Please try signing in again.",
  verification_failed: "That couldn't be verified. Please try again.",
  reset_failed: 'That password reset link is invalid or has expired. Request a new one.',
  no_people: 'Add at least one person to start this conversation.',
  cannot_add_to_direct: "You can't add people to a direct message. Start a group instead.",
};

// Turn a Rails errors.messages hash ({ field: ["is required", ...] }) into one
// readable sentence, so a failed form says WHICH field and why instead of a
// flat "some details need fixing".
function detailsToSentence(details) {
  if (!details || typeof details !== 'object') return null;
  const parts = Object.entries(details).flatMap(([field, msgs]) => {
    const label = field.replace(/_/g, ' ');
    return (Array.isArray(msgs) ? msgs : [msgs]).map((m) => {
      const text = String(m).trim();
      // Rails messages are usually "can't be blank" etc. — prefix the field
      // unless the message already reads as a full sentence.
      return /^[A-Z]/.test(text) ? text : `${label[0].toUpperCase()}${label.slice(1)} ${text}`;
    });
  });
  if (parts.length === 0) return null;
  return parts.slice(0, 3).join('. ') + (parts.length > 3 ? '…' : '.');
}

function messageFor(code, status, data) {
  // A validation failure carries per-field details — surface them so the admin
  // sees what actually needs fixing.
  if (code === 'validation_failed') {
    const specific = detailsToSentence(data?.details);
    if (specific) return specific;
  }
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
    throw new ApiError(messageFor(code, response.status, data), {
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
