// Warms up the screens a carer is most likely to open next.
//
// Screens are code split, so the first visit to each one costs a network
// request for its chunk. On a good connection that is invisible; on a phone in
// a rural dead spot it is a visible pause at exactly the wrong moment. Pulling
// the important chunks in while the device is idle means the tap that matters,
// clocking in, has nothing left to download.
//
// Only the tab bar destinations and the clock screen are warmed. Fetching
// everything would defeat the point of splitting in the first place.

const IMPORTERS = {
  '/home': () => import('../pages/HomePage.jsx'),
  '/clock': () => import('../pages/ClockPage.jsx'),
  '/shifts': () => import('../pages/ShiftsPage.jsx'),
  '/messages': () => import('../pages/MessagesPage.jsx'),
  '/profile': () => import('../pages/ProfilePage.jsx'),
};

const done = new Set();

export function prefetchRoute(path) {
  const key = Object.keys(IMPORTERS).find((k) => path.startsWith(k));
  if (!key || done.has(key)) return;
  done.add(key);
  IMPORTERS[key]().catch(() => done.delete(key));
}

// Called once after the app has painted. requestIdleCallback keeps this off
// the critical path; Safari does not have it, hence the timeout fallback.
export function prefetchTabs() {
  const run = () => Object.keys(IMPORTERS).forEach(prefetchRoute);

  // Never spend a metered or slow connection on speculative downloads.
  const conn = navigator.connection;
  if (conn?.saveData) return;
  if (conn?.effectiveType && /2g/.test(conn.effectiveType)) return;

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1800);
  }
}
