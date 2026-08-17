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
// The endpoint also accepts a `push_subscription`, and this function takes one,
// but every caller passes nothing — deliberately. There is no push transport at
// either end yet: the PWA has no service-worker push handler and no VAPID key,
// and server-side the `push` notification rows are written with status "queued"
// and never sent by anything. Subscribing a carer's browser to a channel with
// no sender would be theatre. Wire both halves together, or neither.
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
