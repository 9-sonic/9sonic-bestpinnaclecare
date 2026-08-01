import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toUser } from './adapters.js';

// Carer authentication. The API keeps admins and employees in separate tables
// with separate login endpoints, so this app only ever talks to /staff.

// Returns either { token, user } or { mfaRequired: true, mfaToken }.
export async function login({ email, password }) {
  const res = env.useMock
    ? await mock.login({ email, password })
    : await api.post('/staff/auth/login', { email, password }, { auth: false });

  if (res.mfa_required) {
    return { mfaRequired: true, mfaToken: res.mfa_token };
  }
  return { token: res.access, user: toUser(res.employee) };
}

// Second step when the account has TOTP enabled.
export async function completeMfa({ mfaToken, otpCode }) {
  const res = env.useMock
    ? await mock.completeMfa({ mfaToken, otpCode })
    : await api.post('/auth/mfa', { mfa_token: mfaToken, otp_code: otpCode }, { auth: false });

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

// No endpoint exists for a carer to edit their own profile or availability, so
// these stay on local data even against the live API. See api_missing.md.
export async function updateProfile(patch) {
  const res = await mock.updateProfile(patch);
  return toUser(res);
}

export async function updateAvailability(availability) {
  const res = await mock.updateAvailability(availability);
  return toUser(res);
}
