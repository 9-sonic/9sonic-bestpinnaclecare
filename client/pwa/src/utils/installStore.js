// Holds the browser's install prompt.
//
// Two things make this awkward, and both were breaking the Install button on
// Android:
//
//   The event fires early. Chrome dispatches `beforeinstallprompt` as soon as
//   it has decided the app is installable, which is usually before React has
//   mounted anything. A listener registered inside a component therefore misses
//   it, and the button ends up with nothing to call. So the listener is set up
//   here at module scope, and this module is imported from the entry file
//   before the app renders.
//
//   There is only ever one prompt. Several places offer to install (the banner,
//   the profile row), and each one holding its own copy in component state
//   meant only whichever mounted first had a usable event. One store, shared.
//
// The event may also only be used once, so it is cleared after prompting.

let deferred = null;
let installed =
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const listeners = new Set();

// The snapshot object is cached and only replaced when a value actually
// changes. useSyncExternalStore compares snapshots with Object.is, so building
// a fresh object on every call makes every comparison unequal and React
// re-renders forever. That is exactly what happened here: a white screen and
// "maximum update depth exceeded" the moment the app mounted.
let snapshot = { available: false, installed: false };

function refresh() {
  const available = !!deferred;
  if (snapshot.available === available && snapshot.installed === installed) return false;
  snapshot = { available, installed };
  return true;
}

function emit() {
  // Only notify when something really moved.
  if (refresh()) listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot() {
  return snapshot;
}

// Called once from main.jsx, before the app renders.
export function initInstallCapture() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Suppress Chrome's own mini-infobar; the app offers install in its own UI.
    e.preventDefault();
    deferred = e;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });

  // Catches the case where the app is launched already installed.
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => {
    installed = e.matches;
    emit();
  });
}

// Returns why it could not run, so the caller can say something useful rather
// than appearing to do nothing.
export async function promptInstall() {
  if (installed) return 'already-installed';
  if (!deferred) return 'unavailable';

  deferred.prompt();
  const { outcome } = await deferred.userChoice;

  // Single use: Chrome will fire a fresh event if the app is still installable.
  deferred = null;
  emit();

  return outcome; // 'accepted' | 'dismissed'
}
