// Carer PWA service worker.
//
// Hand-written (injectManifest) rather than the fully generated worker
// vite-plugin-pwa's generateSW strategy used to produce, because a generated
// worker has nowhere to hang a `push` handler. Everything generateSW used to
// give us for free — precaching, the offline navigation fallback, and the two
// runtime-caching rules — is reproduced below explicitly; only the push and
// notificationclick listeners at the bottom are new. See vite.config.js for
// the manifest/icons/shortcuts config, which is unaffected by this switch.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// registerType: 'prompt' — the app shows its own "new version ready" bar
// (UpdatePrompt.jsx) and posts this message when the carer taps Refresh,
// rather than the worker taking over mid-shift on its own. Do not add an
// unconditional self.skipWaiting() here; that would silently swap the app out
// from under whatever a carer is doing when a new version deploys.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
clientsClaim();

// Offline clock-in is a Must: any navigation that isn't already cached falls
// back to the shell instead of a browser error page.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// API GETs: serve fresh when online, fall back to cache offline.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// The four typefaces the design is drawn in — cached first, kept a year, same
// reasoning as the original runtime-caching rule in vite.config.js.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'font-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// --- Web Push -----------------------------------------------------------
//
// Server side: app/jobs/notifications/push_notification_job.rb sends
// { title, body, tag, url }. Kept minimal and free of anything beyond what a
// lock-screen notification already shows (UK GDPR).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Best Pinnacle Care', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Best Pinnacle Care';
  const options = {
    body: data.body || '',
    icon: '/pwa-icons/icon-192.png',
    badge: '/pwa-icons/icon-96.png',
    // Collapse repeats of the same subject (e.g. several messages in one
    // thread) into a single notification instead of stacking the tray.
    tag: data.tag || undefined,
    // A carer is often mid-visit with the phone in a pocket — silent: false
    // (the default, made explicit here) plays the OS notification tone, and
    // vibrate gives a second, non-audio cue. renotify so a second push with
    // the same tag re-alerts instead of updating the tray silently.
    silent: false,
    vibrate: [200, 100, 200],
    renotify: Boolean(data.tag),
    // Carried through to notificationclick as the deep-link target.
    data: { url: data.url || '/home' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // A carer tab is already open: focus it and route it to the thread
      // rather than opening a second copy of the app.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return undefined;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
