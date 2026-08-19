// Service worker registration.
//
// The plain register API is used rather than the React hook, because the hook
// registers during render and trips React's "state update before mount" warning
// under StrictMode.
//
// Registration matters for two things beyond offline: Chrome will not treat the
// app as installable without an active service worker, and without it the
// offline clock queue has no cached shell to come back to. It was previously
// failing silently, because the dynamic import below sits in an async function
// whose rejection nobody was catching, so a failure looked like success and the
// app quietly had no worker at all.
//
// The update *check* is separate from all of that, and used to be unreliable on
// its own: registerSW() only reacts to whatever the browser's own native
// update check triggers, and that check runs on navigation, not on a timer —
// see https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html, the
// same gap this file works around. A carer who opens the installed app once at
// the start of a shift and never does a full page reload (this is a React
// Router SPA; moving between screens doesn't reload the page) could go an
// entire shift without the browser ever re-checking for a new version, so the
// "a new version is ready" bar had nothing to trigger it. Polling
// registration.update() on an interval, and again whenever the app regains
// focus, closes that gap. It only asks "is there a newer script than the one
// installed" — it does not install or activate anything by itself, so this
// cannot cause the silent mid-shift swap registerType: 'prompt' exists to
// avoid. That part is unchanged: a carer still has to tap Refresh.

let applyUpdate = null;

export const SW_UPDATE_EVENT = 'bpc:sw-update';

function announceUpdate() {
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT));
}

// How often to ask the browser to re-fetch sw.js and compare it byte for byte
// against the installed one. Frequent enough that a carer on a long shift gets
// several chances to notice a deploy; nowhere near frequent enough to be a
// meaningful amount of extra network traffic — the request is a few KB and,
// per spec, browsers already skip it entirely when the file's cache headers
// say it is still fresh.
const UPDATE_CHECK_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

// Checks immediately whenever the app comes back into view — a carer
// unlocking their phone or switching back from another app is exactly the
// moment a check costs nothing and is most likely to land before their next
// clock tap, rather than waiting for the next interval tick to happen to fall
// while they're looking.
function watchForUpdates(registration) {
  if (!registration) return;

  setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registration.update().catch(() => {});
  });
}

// Last resort if the plugin's virtual module cannot be loaded. Registering the
// generated worker directly still gives offline support and installability; it
// only loses the update notification, which is handled here instead.
async function registerDirectly() {
  if (!('serviceWorker' in navigator)) return false;

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  watchForUpdates(registration);

  registration.addEventListener('updatefound', () => {
    const incoming = registration.installing;
    if (!incoming) return;
    incoming.addEventListener('statechange', () => {
      // A worker that reaches "installed" while another controls the page is a
      // new version waiting to take over.
      if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
        announceUpdate();
      }
    });
  });

  applyUpdate = () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    // Reload once the new worker has taken control.
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
  };

  return true;
}

export async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const { registerSW } = await import('virtual:pwa-register');
    applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh: announceUpdate,
      onRegisteredSW(_url, registration) {
        watchForUpdates(registration);
      },
      onRegisterError(error) {
        // eslint-disable-next-line no-console
        console.warn('[sw] registration failed', error);
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[sw] pwa-register unavailable, registering directly', error);
    try {
      await registerDirectly();
    } catch (fallbackError) {
      // eslint-disable-next-line no-console
      console.error('[sw] could not register a service worker', fallbackError);
    }
  }
}

// Activate the waiting worker and reload.
export function applyServiceWorkerUpdate() {
  applyUpdate?.(true);
}
