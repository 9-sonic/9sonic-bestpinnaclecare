// Avatar: shows an image when available, otherwise coloured initials.
// The designs use tinted initial circles for clients (ET, HG, MF).

// Four of these referenced tokens that were never defined
// (--color-purple-bg, --color-purple, --color-green-bg, --color-blue-bg), so
// three names in four got no background at all and the initials fell back to
// inherited text. An undefined custom property paints nothing rather than
// failing loudly, which is why it survived this long.
//
// These are the --tint-* pairs, which are defined for both themes.
const TINTS = [
  { bg: 'var(--tint-teal-bg)', fg: 'var(--tint-teal-fg)' },
  { bg: 'var(--tint-purple-bg)', fg: 'var(--tint-purple-fg)' },
  { bg: 'var(--tint-green-bg)', fg: 'var(--tint-green-fg)' },
  { bg: 'var(--tint-blue-bg)', fg: 'var(--tint-blue-fg)' },
  { bg: 'var(--tint-pink-bg)', fg: 'var(--tint-pink-fg)' },
];

function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Stable tint per name so the same client always gets the same colour.
function tintFor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % TINTS.length;
  return TINTS[hash];
}

export default function Avatar({ name = '', src, size = 44, ring = false }) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        className={`avatar${ring ? ' avatar--ring' : ''}`}
        style={style}
        src={src}
        alt={name}
        loading="lazy"
      />
    );
  }
  const tint = tintFor(name);
  return (
    <span
      className={`avatar avatar--initials${ring ? ' avatar--ring' : ''}`}
      style={{ ...style, background: tint.bg, color: tint.fg, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
