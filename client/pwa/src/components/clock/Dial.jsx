import { useMemo } from 'react';

// The shift timer.
//
// The important thing about this component is that it has to look finished in
// every state, not only while counting. Before, a shift that had not started
// drew an empty grey groove and nothing else, so the screen a carer sees most
// of the time was the one screen with no design on it.
//
// So each state gets its own complete treatment:
//
//   idle       a full ring in a pale brand tint, reading as loaded and ready
//   running    the gradient arc over that ring, with a glowing cap and a pulse
//   break      the same arc held in amber, with the cap still
//   complete   a full ring in the success colour
//   over       amber, because running past the booked end is worth seeing
//
// `progress` is 0..1 of the scheduled duration and may exceed 1.
const SIZE = 300;
const STROKE = 15;
const R = 116;
const TICKS = 60;

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
    const base = R + STROKE / 2 + 7;
    for (let i = 0; i < TICKS; i += 1) {
      const a = (i / TICKS) * 2 * Math.PI - Math.PI / 2;
      const major = i % 5 === 0;
      const len = major ? 10 : 5;
      out.push({
        x1: SIZE / 2 + Math.cos(a) * base,
        y1: SIZE / 2 + Math.sin(a) * base,
        x2: SIZE / 2 + Math.cos(a) * (base + len),
        y2: SIZE / 2 + Math.sin(a) * (base + len),
        major,
        past: i / TICKS <= filled,
      });
    }
    return out;
  }, [filled]);

  return (
    <div className={`dial dial--${state}${over ? ' dial--over' : ''}`}>
      <svg className="dial__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <defs>
          <linearGradient id="dialArc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-teal)" />
            <stop offset="55%" stopColor="var(--brand-cyan)" />
            <stop offset="100%" stopColor="#8af2f7" />
          </linearGradient>

          <linearGradient id="dialArcWarn" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#c98a1e" />
            <stop offset="100%" stopColor="#f0c274" />
          </linearGradient>

          <linearGradient id="dialArcDone" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--success)" />
            <stop offset="100%" stopColor="#63d6a1" />
          </linearGradient>

          {/* A soft light across the face, so it reads as a physical disc. */}
          <linearGradient id="dialFace" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="var(--dial-face-hi)" />
            <stop offset="100%" stopColor="var(--dial-face-lo)" />
          </linearGradient>

          <filter id="dialGroove" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f1e2e" floodOpacity="0.14" />
          </filter>

          <filter id="dialGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="dial__ticks">
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              strokeWidth={t.major ? 2.2 : 1.2}
              className={t.past ? 'is-past' : undefined}
            />
          ))}
        </g>

        {/* The groove. */}
        <circle
          className="dial__track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          strokeWidth={STROKE}
          filter="url(#dialGroove)"
        />

        {/* A full ring in a pale brand tint sitting under the arc. This is what
            gives the idle state something to look at, and under a partial arc
            it reads as the distance still to go. */}
        <circle className="dial__rest" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE - 5} />

        <circle
          className="dial__arc"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          strokeWidth={STROKE}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          filter="url(#dialGlow)"
        />

        {filled > 0.002 && !done && (
          <g className="dial__cap">
            <circle cx={cap.x} cy={cap.y} r={13} className="dial__cap-ring" />
            <circle cx={cap.x} cy={cap.y} r={5.5} className="dial__cap-core" />
          </g>
        )}

        {/* The face, drawn in SVG so it shares the gradient and sits under the
            text without a second stacking context. */}
        <circle className="dial__plate" cx={SIZE / 2} cy={SIZE / 2} r={R - STROKE / 2 - 14} />

        {/* A hairline just inside the plate: a small detail, but it is what
            stops the middle looking like a plain white hole. */}
        <circle
          className="dial__hairline"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R - STROKE / 2 - 22}
        />
      </svg>

      <div className="dial__face">{children}</div>
    </div>
  );
}
