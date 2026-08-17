// Web Push subscription for the office app.
//
// Flow: register the service worker -> fetch the VAPID public key from the API
// (so it can rotate without a rebuild) -> ask permission -> subscribe with the
// push service -> hand the subscription to the API against this admin's device.
//
// Everything is defensive: an unsupported browser, a denied permission, or a
// missing key returns a clear reason rather than throwing, so the UI can say
// what happened.

import env from '../config/env.js';
import { getPushConfig, registerDevice, deleteDevice } from '../api/index.js';

const FINGERPRINT_KEY = 'bpc.admin.device.fingerprint';

// True only where the browser can actually do Web Push.
export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// A stable id for this browser, so re-subscribing updates the same device row
// instead of piling up duplicates. Cleared if the user wipes site data — fine.
function deviceFingerprint() {
  try {
    let id = localStorage.getItem(FINGERPRINT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(FINGERPRINT_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// VAPID keys arrive base64url-encoded; the subscribe call needs raw bytes.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getVapidPublicKey() {
  // Prefer a build-time key if pinned; otherwise ask the API.
  if (env.vapidPublicKey) return env.vapidPublicKey;
  const cfg = await getPushConfig();
  if (!cfg?.enabled || !cfg.public_key) return null;
  return cfg.public_key;
}

async function ensureServiceWorker() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

// Turn on push for this browser. Returns { ok, reason? }.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return { ok: false, reason: 'not_configured' };

  const registration = await ensureServiceWorker();
  await navigator.serviceWorker.ready;

  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await registerDevice({
    fingerprint: deviceFingerprint(),
    platform: navigator.userAgentData?.platform || navigator.platform || 'web',
    push_subscription: subscription.toJSON(),
  });

  return { ok: true };
}

// Turn push off for this browser: drop the subscription and revoke the device.
export async function disablePush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  const fp = deviceFingerprint();
  if (fp) await deleteDevice(fp).catch(() => {});
  return { ok: true };
}

// Current state for the UI: 'unsupported' | 'denied' | 'granted' | 'default'.
export function pushPermission() {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

// Is this browser already subscribed?
export async function isSubscribed() {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  return Boolean(subscription);
}
