// Avatar: shows an image when available, otherwise coloured initials.
// The designs use tinted initial circles for clients (ET, HG, MF).

const TINTS = [
  { bg: 'var(--teal-100)', fg: 'var(--teal-600)' },
  { bg: 'var(--color-purple-bg)', fg: 'var(--color-purple)' },
  { bg: 'var(--color-green-bg)', fg: 'var(--color-success)' },
  { bg: 'var(--color-blue-bg)', fg: '#3b82f6' },
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
