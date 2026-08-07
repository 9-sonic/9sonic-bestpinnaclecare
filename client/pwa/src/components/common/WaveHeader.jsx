// The teal header on the sign in screen.
//
// Three overlapping curves rather than one: the design has a dark teal field
// with two lighter ribbons sweeping across it, which is what stops it reading
// as a flat coloured block. They are separate paths at different opacities so
// the overlaps deepen the colour on their own.
//
// preserveAspectRatio is set to slice so the artwork fills any width without
// the curve flattening out on a tablet.
export default function WaveHeader({ height = 210, children }) {
  return (
    <div className="wave" style={{ height }}>
      <svg
        className="wave__art"
        viewBox="0 0 390 210"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="waveBase" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0b5f6e" />
            <stop offset="55%" stopColor="#12a2b6" />
            <stop offset="100%" stopColor="#2ed3dd" />
          </linearGradient>
          <linearGradient id="waveRibbon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2ed3dd" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#7ff0f5" stopOpacity="0.28" />
          </linearGradient>
        </defs>

        {/* Base field, curving away at the bottom. */}
        <path
          d="M0 0h390v128c-58 26-104 30-160 18C160 132 96 118 44 132 27 137 12 143 0 150z"
          fill="url(#waveBase)"
        />
        {/* Light ribbon sweeping from the left shoulder. */}
        <path
          d="M0 0c74 8 118 34 168 62 44 25 88 44 146 40 30-2 55-9 76-18V0z"
          fill="url(#waveRibbon)"
        />
        {/* Second, tighter ribbon that catches the top right. */}
        <path
          d="M390 0v58c-40 14-79 12-118-4-30-13-56-33-84-54z"
          fill="#7ff0f5"
          opacity="0.22"
        />
      </svg>

      {children && <div className="wave__content">{children}</div>}
    </div>
  );
}
