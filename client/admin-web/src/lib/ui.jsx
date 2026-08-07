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
