import { useMemo } from 'react';

// Circular progress dial with tick marks, matching the Clock In design.
// `progress` is 0..1 of the shift elapsed.
const SIZE = 240;
const R = 106;
const TICKS = 60;

export default function Dial({ progress = 0, state = 'idle', children }) {
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1));

  // Tick marks around the rim; ones already passed are highlighted.
  const ticks = useMemo(() => {
    const out = [];
    for (let i = 0; i < TICKS; i += 1) {
      const angle = (i / TICKS) * 2 * Math.PI - Math.PI / 2;
      const inner = R - 14;
      const outer = R - 8;
      out.push({
        x1: SIZE / 2 + Math.cos(angle) * inner,
        y1: SIZE / 2 + Math.sin(angle) * inner,
        x2: SIZE / 2 + Math.cos(angle) * outer,
        y2: SIZE / 2 + Math.sin(angle) * outer,
        past: i / TICKS <= progress,
      });
    }
    return out;
  }, [progress]);

  return (
    <div className={`dial dial--${state}`}>
      <svg className="dial__svg" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--teal-300)" />
            <stop offset="100%" stopColor="var(--teal-600)" />
          </linearGradient>
        </defs>
        <circle className="dial__track" cx={SIZE / 2} cy={SIZE / 2} r={R} />
        <circle
          className="dial__progress"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <g className="dial__ticks">
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              className={t.past ? 'is-past' : undefined}
            />
          ))}
        </g>
      </svg>
      <div className="dial__face">{children}</div>
    </div>
  );
}
