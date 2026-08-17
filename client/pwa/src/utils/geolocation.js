// Capture the device's current GPS position.
//
// Clocking must never be blocked entirely by a location failure — the backend
// decides what a missing or distant fix means, and whether that stops anything
// is client policy nobody has settled. So nothing here throws or rejects.
//
// But "no fix" is not one outcome, it is four, and the difference is the whole
// story a carer needs: permission denied is a thing they can fix, no signal is
// a thing they wait out, and "still looking" is not a failure at all. Collapsing
// them into a single null is what let the clock screen tell a carer their
// location was fine while nothing had been captured, right up until the server
// rejected the clock-in. So requestLocation() reports which one happened, and
// getCurrentLocation() is kept as the fix-or-null wrapper for callers that only
// want the coordinates.

const toFix = (pos) => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  capturedAt: new Date().toISOString(),
});

// GeolocationPositionError codes. Named because `err.code === 1` at a call site
// is unreadable, and the constants live on the error instance rather than
// anywhere we can import.
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

function statusFromError(err) {
  switch (err?.code) {
    case PERMISSION_DENIED:
      return 'denied';
    case TIMEOUT:
      return 'timeout';
    case POSITION_UNAVAILABLE:
    default:
      return 'unavailable';
  }
}

// Resolves to { fix, status }:
//   fix     the position, or null if none was captured
//   status  'ok' | 'denied' | 'unavailable' | 'timeout'
//
// Never rejects.
export function requestLocation({ timeout = 15000, maximumAge = 30000 } = {}) {
  return new Promise((resolve) => {
    // Tested for callability, not with `in`. A locked-down WebView or a frame
    // blocked by permissions policy can carry a `geolocation` property that is
    // undefined or throws on use — `'geolocation' in navigator` is true in both
    // cases, and the throw used to reject this promise. Nothing awaits a
    // rejection here, so the clock screen sat on "Checking location…" forever.
    const geo = navigator.geolocation;
    if (typeof geo?.getCurrentPosition !== 'function') {
      resolve({ fix: null, status: 'unavailable' });
      return;
    }

    const giveUp = (err) => resolve({ fix: null, status: statusFromError(err) });

    // A cold high-accuracy fix routinely takes longer than a few seconds on a
    // phone, and the very first tap after login often has no fix yet. So: allow
    // a recent fix (maximumAge), give it a real timeout, and if high accuracy
    // still fails, fall back to a coarse/fast fix rather than sending none —
    // sending no location silently bypasses the geofence.
    //
    // The second attempt's error is the one reported. A denial comes back as
    // code 1 from both attempts, so nothing is lost by letting the fallback run
    // and reading its result.
    // Every call is guarded: a throw from the platform must come back as
    // "unavailable", never as a rejected promise.
    try {
      geo.getCurrentPosition(
        (pos) => resolve({ fix: toFix(pos), status: 'ok' }),
        () => {
          try {
            geo.getCurrentPosition(
              (pos) => resolve({ fix: toFix(pos), status: 'ok' }),
              giveUp,
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
            );
          } catch {
            giveUp();
          }
        },
        { enableHighAccuracy: true, timeout, maximumAge }
      );
    } catch {
      giveUp();
    }
  });
}

// The coordinates only, or null. Unchanged contract for callers that do not
// care why a fix is missing.
export function getCurrentLocation(options) {
  return requestLocation(options).then((res) => res.fix);
}
