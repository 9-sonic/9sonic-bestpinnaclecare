// Parse a CSS declaration string into a React style object, so the design's
// inline CSS is kept verbatim rather than hand-translated rule by rule.
//
// Accessibility: the office app is used by staff who are often 50+, so the whole
// UI is scaled up a notch for legibility and comfortable tap/click targets. Every
// pixel value that flows through s() is multiplied by UI_SCALE, in real px — so
// layout, scrolling and fixed positioning all keep behaving normally (unlike a
// CSS zoom, which fights the full-height shell). Non-px units (%, vh, rem, deg,
// s, colours) are left untouched. To retune the whole app, change this one number.
export const UI_SCALE = 1.12;

// Multiply every `<n>px` token in a value by UI_SCALE, snapped to the nearest
// 0.5px so hairline borders (1px) stay crisp rather than drifting to 1.1px.
function scalePx(value) {
  return value.replace(/(-?\d*\.?\d+)px\b/g, (_, n) => {
    const scaled = Math.round(parseFloat(n) * UI_SCALE * 2) / 2;
    return `${scaled}px`;
  });
}

// SVG icon glyphs are sized by a numeric prop, not by s(); scale one to match.
export const px = (n) => Math.round(n * UI_SCALE);

export function s(css) {
  const o = {};
  String(css).split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    let k = decl.slice(0, i).trim();
    const v = decl.slice(i + 1).trim();
    if (!k) return;
    if (k[0] !== '-') k = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[k] = v.includes('px') ? scalePx(v) : v;
  });
  return o;
}

// Reject an oversized image before it's uploaded (the server also enforces 5MB;
// this gives instant feedback). Returns an error string, or null when OK.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export function imageTooLarge(file) {
  if (file && file.size > MAX_IMAGE_BYTES) return 'That image is over 5 MB. Please choose a smaller one.';
  return null;
}

// Message attachments (docs, images, audio, video): 25 MB per file, matching the
// backend's Message::MESSAGE_FILE_MAX_BYTES gate. Checked here first so an
// oversize file is rejected with a clear message before it's ever uploaded.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB
export function attachmentTooLarge(file) {
  if (file && file.size > MAX_ATTACHMENT_BYTES) return `“${file.name}” is over 25 MB. Please choose a smaller file.`;
  return null;
}
