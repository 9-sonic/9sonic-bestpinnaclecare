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

let applyUpdate = null;

export const SW_UPDATE_EVENT = 'bpc:sw-update';

function announceUpdate() {
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT));
}

// Last resort if the plugin's virtual module cannot be loaded. Registering the
// generated worker directly still gives offline support and installability; it
// only loses the update notification, which is handled here instead.
async function registerDirectly() {
  if (!('serviceWorker' in navigator)) return false;

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

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
