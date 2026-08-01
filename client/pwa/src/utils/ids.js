// Identifiers the API needs from the client.

// RFC 4122 v4 UUID. crypto.randomUUID is available in every browser that can
// run this app, but it is only exposed on secure origins, so there is a
// fallback for plain http during local development.
export function newUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  (globalThis.crypto ?? { getRandomValues: (a) => a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256))) })
    .getRandomValues?.(bytes) ?? bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// A stable id for this browser profile, sent with clock events so the office
// can see when the same tap arrives from an unexpected device. Not a security
// control: it is cleared if the user wipes site data, which is fine.
const DEVICE_KEY = 'bpc.device.fingerprint';

export function deviceFingerprint() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = newUuid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
