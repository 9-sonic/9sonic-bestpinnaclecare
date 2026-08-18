// Short cues so a carer can tell a new chat message from an office
// notification without looking, while the app is open — the in-tab
// counterpart to the OS push tone the service worker plays when it isn't.
// Mirrors client/admin-web/src/lib/sounds.js (same files, same behaviour).
//
// Browsers block audio until the user has interacted with the page; the first
// play() after a tap succeeds and unlocks the rest, so a cue that arrives
// before any interaction is silently dropped (caught below) rather than
// throwing.

const FILES = {
  message: '/mixkit-bubble-pop-up-alert-notification-2357.wav',
  notification: '/mixkit-positive-notification-951.wav',
};

const cache = {};

function audioFor(kind) {
  if (!cache[kind]) {
    const a = new Audio(FILES[kind]);
    a.preload = 'auto';
    a.volume = 0.5;
    cache[kind] = a;
  }
  return cache[kind];
}

// Play a cue. `kind` is 'message' | 'notification'. Never throws.
export function playSound(kind) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('bpc.sound.mute') === '1') return;
  const a = audioFor(kind);
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play?.().catch(() => {}); // autoplay blocked / not yet interacted — ignore
  } catch { /* ignore */ }
}

export function isMuted() {
  return typeof window !== 'undefined' && localStorage.getItem('bpc.sound.mute') === '1';
}

export function setMuted(muted) {
  if (typeof window === 'undefined') return;
  if (muted) localStorage.setItem('bpc.sound.mute', '1');
  else localStorage.removeItem('bpc.sound.mute');
}
