import { useMemo } from 'react';

// The shift timer.
//
// Matches the redesign: a thin ring rather than a heavy groove, the tick scale
// moved outside the ring where it reads as a measure instead of decoration, and
// a plain white disc in the middle carrying the state above the time.
//
// The arc colour is the state:
//
//   idle       nothing drawn, just the ring and the scale
//   running    teal through cyan
//   break      amber, because a paused shift should not look like a running one
//   complete   the ring filled in the success colour
//   over       amber, since running past the booked end is worth seeing
//
// `progress` is 0..1 of the scheduled duration and may exceed 1.
const SIZE = 300;
const R = 116; // arc radius
const STROKE = 10; // the ring is thin in the new design
const TICKS = 60;
const TICK_INNER = R + 14; // the scale sits outside the ring, not on it

export default function Dial({ progress = 0, state = 'idle', children }) {
  const over = progress > 1.001;
  const shown = Math.min(Math.max(progress, 0), 1);
  const done = state === 'complete';

  const circumference = 2 * Math.PI * R;
  // A finished shift fills the ring regardless of the arithmetic.
  const filled = done ? 1 : shown;
  const offset = circumference * (1 - filled);

  const angle = filled * 2 * Math.PI - Math.PI / 2;
  const cap = {
    x: SIZE / 2 + Math.cos(angle) * R,
    y: SIZE / 2 + Math.sin(angle) * R,
  };

  const ticks = useMemo(() => {
    const out = [];
    for (let i = 0; i < TICKS; i += 1) {
      const a = (i / TICKS) * 2 * Math.PI - Math.PI / 2;
      // Every fifth mark is longer, which gives the scale a rhythm without
      // needing numbers on it.
      const major = i % 5 === 0;
      const len = major ? 13 : 7;
      out.push({
        x1: SIZE / 2 + Math.cos(a) * TICK_INNER,
        y1: SIZE / 2 + Math.sin(a) * TICK_INNER,
        x2: SIZE / 2 + Math.cos(a) * (TICK_INNER + len),
        y2: SIZE / 2 + Math.sin(a) * (TICK_INNER + len),
        major,
        past: i / TICKS <= filled && filled > 0,
      });
    }
    return out;
  }, [filled]);

  return (
    <div className={`dial dial--${state}${over ? ' dial--over' : ''}`}>
      <svg className="dial__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <defs>
          <linearGradient id="dialArc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-deep)" />
            <stop offset="60%" stopColor="var(--brand-teal)" />
            <stop offset="100%" stopColor="var(--brand-cyan)" />
          </linearGradient>

          <linearGradient id="dialArcWarn" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#e08a2b" />
            <stop offset="100%" stopColor="#f2a852" />
          </linearGradient>

          <linearGradient id="dialArcDone" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--success)" />
            <stop offset="100%" stopColor="#63d6a1" />
          </linearGradient>
        </defs>

        {/* The scale, outside the ring. */}
        <g className="dial__ticks">
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              strokeWidth={t.major ? 2.4 : 1.4}
              className={t.past ? 'is-past' : undefined}
            />
          ))}
        </g>

        {/* The ring the arc runs along. Thin, and always fully drawn, so the
            idle dial still reads as a dial rather than an empty space. */}
        <circle
          className="dial__track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          strokeWidth={STROKE}
        />

        <circle
          className="dial__arc"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          strokeWidth={STROKE}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />

        {/* The leading edge: a white bead with a coloured ring, so the current
            position is findable at a glance on a bright screen. */}
        {filled > 0.002 && !done && (
          <g className="dial__cap">
            <circle cx={cap.x} cy={cap.y} r={9} className="dial__cap-ring" />
          </g>
        )}

        {/* The white disc the time sits on. Drawn in the SVG so it shares the
            same coordinate space as the ring and cannot drift out of centre.
            The gap to the ring is deliberate: with the disc any larger the two
            read as one heavy blob rather than a dial with a face. */}
        <circle
          className="dial__plate"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R - STROKE / 2 - 34}
        />
      </svg>

      <div className="dial__face">{children}</div>
    </div>
  );
}
