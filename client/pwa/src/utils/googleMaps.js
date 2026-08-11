import env from '../config/env.js';

// Loads the Google Maps JS SDK once (needed for DirectionsService — the embed
// iframe renders a map but never exposes ETA/distance to the page). Rejects if
// there is no key or the script fails, so callers can fall back honestly rather
// than showing invented numbers.
let loaderPromise = null;

export function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loaderPromise) return loaderPromise;
  if (!env.mapsApiKey) return Promise.reject(new Error('no_maps_key'));

  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(env.mapsApiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.google?.maps ? resolve(window.google.maps) : reject(new Error('maps_load_failed'));
    script.onerror = () => reject(new Error('maps_load_failed'));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

// Real driving route from the carer's position to the visit.
//   origin:      { latitude, longitude }  (from getCurrentLocation)
//   destination: { lat, lng }             (the service user's coords)
// Resolves { distanceText, durationText, durationSec } or throws (no key, no
// route, API not enabled, offline, …) — the caller shows a dash, never a guess.
export async function getDrivingRoute(origin, destination) {
  const maps = await loadGoogleMaps();
  const result = await new maps.DirectionsService().route({
    origin: { lat: origin.latitude, lng: origin.longitude },
    destination: { lat: destination.lat, lng: destination.lng },
    travelMode: maps.TravelMode.DRIVING,
  });
  const leg = result?.routes?.[0]?.legs?.[0];
  if (!leg) throw new Error('no_route');
  return {
    distanceText: leg.distance?.text ?? null,
    durationText: leg.duration?.text ?? null,
    durationSec: leg.duration?.value ?? null,
  };
}
