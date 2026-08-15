import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { setRefreshToken, setTokenExpiry, getToken } from '../utils/storage.js';
import { toUser, toAvailabilityDays, toAvailabilityEntries } from './adapters.js';

// Carer authentication. The API keeps admins and employees in separate tables
// with separate login endpoints, so this app only ever talks to /staff.

// The staff login is documented as returning { access, employee } only. If it
// ever also returns a refresh token, this picks it up with no further change —
// see the refresh handling in client.js.
function storeSessionExtras(res) {
  if (res?.refresh_token) setRefreshToken(res.refresh_token);
  if (res?.access_expires_at) setTokenExpiry(res.access_expires_at);
}

// Returns either { token, user } or { mfaRequired: true, mfaToken }.
export async function login({ email, password }) {
  const res = env.useMock
    ? await mock.login({ email, password })
    : await api.post('/staff/auth/login', { email, password }, { auth: false });

  if (res.mfa_required) {
    return { mfaRequired: true, mfaToken: res.mfa_token };
  }

  storeSessionExtras(res);
  return { token: res.access, user: toUser(res.employee) };
}

// Second step when the account has TOTP enabled.
export async function completeMfa({ mfaToken, otpCode }) {
  const res = env.useMock
    ? await mock.completeMfa({ mfaToken, otpCode })
    : await api.post('/auth/mfa', { mfa_token: mfaToken, otp_code: otpCode }, { auth: false });

  storeSessionExtras(res);
  return { token: res.access, user: toUser(res.employee ?? res.admin) };
}

export async function fetchCurrentUser() {
  const res = env.useMock ? await mock.fetchCurrentUser() : await api.get('/staff/me');
  return toUser(res);
}

export function logout() {
  if (env.useMock) return mock.logout();
  return api.delete('/auth/logout');
}

// Password reset. The API always answers 202 so the form cannot be used to
// find out which addresses have accounts.
export function requestPasswordReset(email) {
  if (env.useMock) return mock.requestPasswordReset(email);
  return api.post('/staff/auth/password', { email }, { auth: false });
}

export function resetPassword({ token, password }) {
  if (env.useMock) return mock.resetPassword({ token, password });
  return api.put('/staff/auth/password', { token, password }, { auth: false });
}

// ---------------------------------------------------------------------------
// Profile — PATCH /staff/me
//
// The endpoint takes first_name and last_name separately, so the single "Full
// name" field is split on the last space. That is wrong for some names, which
// is part of why the office can still correct it.
//
// Email is deliberately not sent: it is the login identifier and stays office
// controlled, so the endpoint does not accept it. Name and phone are now in the
// same position, which is why this no longer needs to split a display name into
// first and last.
// ---------------------------------------------------------------------------

// Emergency contact is the only part of their own record a carer maintains.
// Name and phone used to be sent here too; they are the office's record, so the
// client no longer asks to change them. The server remains the authority — this
// is the client keeping its request honest, not an access control.
export async function updateProfile(patch) {
  if (env.useMock) return toUser(await mock.updateProfile(patch));

  const body = {
    emergency_contact_name: patch.emergencyContactName ?? null,
    emergency_contact_phone: patch.emergencyContactPhone ?? null,
  };

  return toUser(await api.patch('/staff/me', body));
}

// Profile photo — POST /staff/me/avatar (multipart). Uses a raw fetch so the
// browser sets the multipart boundary (the JSON client would force
// application/json and drop the file). Returns the refreshed user.
export async function uploadAvatar(file) {
  if (env.useMock) return toUser(await mock.fetchCurrentUser());

  const fd = new FormData();
  fd.append('avatar', file);
  const res = await fetch(`${env.apiBaseUrl}/staff/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { /* non-json */ }
    const msg = err?.error === 'too_large' ? 'That image is too large (max 5 MB).'
      : err?.error === 'unsupported_type' ? 'Please choose a PNG, JPG, WEBP or GIF.'
      : 'Could not upload the photo.';
    throw new Error(msg);
  }
  return toUser(await res.json());
}

// DELETE /staff/me/avatar — falls back to initials.
export async function removeAvatar() {
  if (env.useMock) return toUser(await mock.fetchCurrentUser());
  return toUser(await api.delete('/staff/me/avatar'));
}

// ---------------------------------------------------------------------------
// Availability — GET/PUT /staff/availability
//
// The screen thinks in days holding slots; the API stores one row per weekday
// per slot. Saving reads first so the `night` slot — which the API models and
// the screen does not render — is carried through instead of being cleared by
// a replace the carer never saw.
// ---------------------------------------------------------------------------
export async function getAvailability() {
  if (env.useMock) return toAvailabilityDays(await mock.getAvailability());
  return toAvailabilityDays(await api.get('/staff/availability'));
}

export async function updateAvailability(days) {
  if (env.useMock) {
    await mock.updateAvailability(days);
    return days;
  }

  let previous = null;
  try {
    previous = await api.get('/staff/availability');
  } catch {
    // A failed read must not block the save. Worst case the night slot resets,
    // which the office can see, rather than the save failing silently.
  }

  await api.put('/staff/availability', { entries: toAvailabilityEntries(days, previous) });
  return days;
}
