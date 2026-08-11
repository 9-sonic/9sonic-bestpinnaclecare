// Capture the device's current GPS position. Resolves to { latitude, longitude,
// accuracy } or null if unavailable / permission denied - clocking should never
// be blocked entirely by a location failure (the backend can flag it instead).

const toFix = (pos) => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  capturedAt: new Date().toISOString(),
});

export function getCurrentLocation({ timeout = 15000, maximumAge = 30000 } = {}) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    // A cold high-accuracy fix routinely takes longer than a few seconds on a
    // phone, and the very first tap after login often has no fix yet. So: allow
    // a recent fix (maximumAge), give it a real timeout, and if high accuracy
    // still fails, fall back to a coarse/fast fix rather than sending none —
    // sending no location silently bypasses the geofence.
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toFix(pos)),
      () =>
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(toFix(pos)),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        ),
      { enableHighAccuracy: true, timeout, maximumAge }
    );
  });
}
