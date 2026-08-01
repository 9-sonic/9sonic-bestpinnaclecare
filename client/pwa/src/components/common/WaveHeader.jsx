// Teal header with the curved wave bottom edge used on Login and Profile.
// The curve is an SVG so it scales cleanly at any width.
export default function WaveHeader({ height = 150, children }) {
  return (
    <div className="wave-header" style={{ minHeight: height }}>
      <div className="wave-header__content">{children}</div>
      <svg
        className="wave-header__curve"
        viewBox="0 0 375 60"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 0c60 44 140 56 210 42 55-11 110-34 165-42v60H0z"
          fill="var(--color-bg)"
        />
      </svg>
    </div>
  );
}
