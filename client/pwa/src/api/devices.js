import api from './client.js';
import env from '../config/env.js';
import { deviceFingerprint } from '../utils/ids.js';

// ---------------------------------------------------------------------------
// POST /staff/devices
//
// Registers this browser against the carer's account, so the office can see
// which device a clock tap came from. The same fingerprint rides on every clock
// event, so the two join up.
//
// The endpoint also accepts a `push_subscription`. Every call on the sign-in
// path still passes none — registration there must never block reaching the
// clock screen, and a carer who hasn't opted in has nothing to subscribe.
// `../lib/push.js` sends one explicitly once a carer turns push on from
// Preferences.
//
// Registration is best effort: it must never block or fail a sign-in, because a
// carer who cannot get past the login screen cannot clock in.
// ---------------------------------------------------------------------------

function platform() {
  const ua = globalThis.navigator;
  return ua?.userAgentData?.platform || ua?.platform || 'web';
}

export async function registerDevice({ pushSubscription } = {}) {
  if (env.useMock) return { ok: true };

  const fingerprint = deviceFingerprint();
  // No fingerprint means storage is unavailable (private mode). Nothing to
  // register, and nothing worth failing over.
  if (!fingerprint) return { ok: false };

  return api.post('/staff/devices', {
    fingerprint,
    platform: platform(),
    app_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null,
    ...(pushSubscription ? { push_subscription: pushSubscription } : null),
  });
}

// Fire and forget. Callers on the sign-in path should use this rather than
// awaiting registerDevice directly.
export function registerDeviceQuietly(options) {
  return registerDevice(options).catch(() => ({ ok: false }));
}

// DELETE /staff/devices/:fingerprint — revokes this browser's device row (and
// with it, any push subscription stored against it). Used when a carer turns
// push off from Preferences.
export function deleteDevice(fingerprint) {
  if (env.useMock || !fingerprint) return Promise.resolve({ ok: true });
  return api.delete(`/staff/devices/${fingerprint}`);
}

// GET /staff/push/config — { enabled, public_key }. Fetched at runtime rather
// than baked into the build so the VAPID key can rotate without a redeploy.
export function getPushConfig() {
  if (env.useMock) return Promise.resolve({ enabled: false, public_key: null });
  return api.get('/staff/push/config');
}
