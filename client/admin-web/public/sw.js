/* Office web app service worker — Web Push only.
 *
 * Deliberately minimal: it does NOT cache or intercept fetches (the office app
 * is online-first, unlike the carer PWA). Its whole job is to show a
 * notification when the API pushes one, and to focus/open the right page when
 * the admin clicks it.
 */

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
    icon: '/logo.png',
    badge: '/logo.png',
    // Collapse repeats of the same subject into one notification.
    tag: data.tag || undefined,
    // Carry the click target through to notificationclick.
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an office tab is already open, focus it and route it to the target.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(target).catch(() => {});
          return undefined;
        }
      }
      // Otherwise open a new one.
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});
