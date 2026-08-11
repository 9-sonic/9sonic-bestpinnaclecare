import { useMemo } from 'react';
import env from '../../config/env.js';
import Icon from '../common/Icon.jsx';

// The map shown inside the app.
//
// Three levels, chosen by what is configured rather than by a flag:
//
//   1. A maps key is set, so an embedded Google map is rendered in an iframe.
//      This is the default the office asked for: the route appears in the app
//      rather than throwing the carer out to another program.
//   2. No key, but the address has coordinates, so an OpenStreetMap tile is
//      embedded instead. No key needed, and it is enough to see where the
//      house is.
//   3. Neither, so the drawn placeholder is used and the carer can still hand
//      off to their phone's map app.
//
// The iframe is sandboxed and referrer-suppressed: it is third party content
// sitting inside a page that shows care records, so it gets no more access
// than it needs.
export default function EmbeddedMap({ destination, coords, origin, mode = 'directions' }) {
  const src = useMemo(() => {
    const query = encodeURIComponent(destination ?? '');
    // Prefer coordinates for the destination — a lat,lng always resolves,
    // whereas a text address can geocode to the wrong place or nothing.
    const dest =
      coords?.lat != null && coords?.lng != null ? `${coords.lat},${coords.lng}` : query;

    if (env.mapsApiKey) {
      const base = 'https://www.google.com/maps/embed/v1';
      // Directions only when we have a real starting coordinate. The old code
      // used origin=My+Location, which never resolves inside an iframe and left
      // the map blank — so we only draw a route with an actual origin, and
      // otherwise show the destination as a place (which always renders).
      if (mode === 'directions' && origin?.latitude != null && origin?.longitude != null) {
        return `${base}/directions?key=${env.mapsApiKey}&destination=${dest}&origin=${origin.latitude},${origin.longitude}&mode=driving`;
      }
      return `${base}/place?key=${env.mapsApiKey}&q=${dest}&zoom=15`;
    }

    if (coords?.lat != null && coords?.lng != null) {
      // A small bounding box around the address, roughly 500m across.
      const d = 0.005;
      const bbox = [coords.lng - d, coords.lat - d, coords.lng + d, coords.lat + d].join('%2C');
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`;
    }

    return null;
  }, [destination, coords, mode]);

  if (!src) {
    return (
      <div className="map-fallback">
        <span className="map-fallback__icon">
          <Icon name="pin" size={22} />
        </span>
        <p className="map-fallback__title">No map available</p>
        <p className="map-fallback__text">
          This address has no coordinates saved. Ask the office to add them, or open it in your
          maps app below.
        </p>
      </div>
    );
  }

  return (
    <iframe
      className="map-frame"
      title={`Map showing ${destination}`}
      src={src}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      sandbox="allow-scripts allow-same-origin allow-popups"
      allow="geolocation"
    />
  );
}
