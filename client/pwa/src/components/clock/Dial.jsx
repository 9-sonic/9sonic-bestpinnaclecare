import { useEffect, useMemo, useRef, useState } from 'react';

// The shift timer.
//
// The geometry is taken directly from the countdown prototype rather than
// re-derived, because the proportions are the design: a wide pale groove with a
// narrower bright arc riding in it, a glow ring sitting just outboard of the
// arc rather than behind it, a tick scale set well clear of the ring so it
// reads as a measure rather than as decoration, and a large disc in the middle.
// The numbers below are the prototype's, in its own 320-unit space; the CSS
// scales the whole thing.
//
// The arc is drawn with a radial gradient, not a flat stroke. Because the
// gradient is in user space and its radius is a little larger than the arc, the
// stops land *across* the stroke's width rather than along its length: a shaded
// inner edge, a flat body, a bright lip on the outside. That is what makes it
// read as a cylinder bent around the dial instead of as a painted line. The two
// coincident stops are what give the lip its hard edge — spread them and the
// arc goes soft and plastic.
//
// The clock starts at six o'clock and runs clockwise. The prototype does that
// by rotating the whole SVG 90°, which is not available here: rotating the SVG
// also rotates the scale and the plate's shadow, and tests/layout.spec.js fails
// the build if .dial__svg carries a transform — that leftover rotation is one
// of the things that broke the dial before. So the start angle is applied to
// each piece instead, and the drawing itself stays upright.
//
// The arc colour is the state:
//
//   idle       nothing drawn, just the pale groove and the scale
//   running    teal through cyan
//   break      amber, because a paused shift should not look like a running one
//   complete   the ring filled in the success colour
//   over       amber, since running past the booked end is worth seeing
//
// The colours are not switched by swapping gradients — the gradient stops read
// CSS variables, and the state class redefines those variables. The <defs> live
// inside the same element as the state class, so the cascade reaches them. That
// keeps one gradient definition instead of one per state, and lets dark mode
// retune the arc without touching this file.
//
// `progress` is 0..1 of the scheduled duration and may exceed 1.

const MID = 160; // centre of the prototype's coordinate space
// The scale runs to 180, past the 320 box, so the box is opened up to fit it.
const VIEW = '-12 -12 344 344';

const R = 136; // the arc and the groove share a radius
const TRACK_STROKE = 20; // the groove
const ARC_STROKE = 11; // the arc riding in it
const GLOW_R = 143; // outboard of the arc, not behind it
const GLOW_STROKE = 20;
const PLATE_R = 103;
const PIN_R = 140; // the bead sits just proud of the arc
const TICKS = 60;
const TICK_INNER = 168;
const TICK_OUTER = 180;
const GRADIENT_R = 145;

// Six o'clock. SVG angles start at three o'clock and increase clockwise.
const START = Math.PI / 2;
const START_DEG = 90;

// Time constant of the exponential approach, not a duration: the value closes
// roughly 95% of the remaining gap in three of these.
const EASE_MS = 180;

// Eases `target` towards its new value and returns the value part-way there.
//
// This exists so that the arc, the glow, the bead and the lit ticks all move
// off one number. The obvious alternative — a CSS transition on the arc — eases
// only the things CSS can interpolate, so the bead and the ticks jump to the
// new position while the arc is still travelling to it. On a real six-hour
// visit the step is sub-pixel and nobody would notice; wound forward, the bead
// visibly detaches from the end of the arc and the scale lights up ahead of it.
//
// Easing the input instead keeps the parts welded together by construction
// rather than by three transitions happening to agree.
//
// Only forward creep is eased. A shift ticking along moves the value by a
// hair, and smoothing that is the whole point; but clocking out, switching to
// another visit or starting a new shift moves it a long way, or backwards, and
// easing *that* animates the ring unwinding like a stopwatch being rewound.
// Those are changes of subject, not progress, so they land immediately.
const JUMP = 0.25;

function useEased(target) {
  const [value, setValue] = useState(target);
  // The animation's real state lives in refs, and the frame loop reads only
  // those. An earlier version kept it in `value` and restarted the ease from
  // whatever the render closure held, which was sometimes one render behind the
  // last frame it had painted — so the arc restarted from slightly *behind*
  // where it already was and crept backwards. Sixty times a second that reads
  // as a shimmer around the rim rather than as a clock ticking forward.
  const valueRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (valueRef.current === target) return undefined;

    // Honour the OS setting: no easing, just land on the value.
    const still =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = performance.now();

    const frame = (now) => {
      // Clamped so a backgrounded tab does not resume with one enormous step.
      const dt = Math.min(64, now - last);
      last = now;

      const to = targetRef.current;
      const from = valueRef.current;
      let next;

      if (still || to < from || to - from > JUMP) {
        // Not progress — a reset, a different visit, or a clock-out. Land.
        next = to;
      } else {
        // Exponential approach. Frame-rate independent, and monotonic by
        // construction: `next` always lies between `from` and `to`, so the
        // ring can never step backwards while a shift is running.
        next = from + (to - from) * (1 - Math.exp(-dt / EASE_MS));
        if (to - next < 0.0002) next = to;
      }

      if (next !== from) {
        valueRef.current = next;
        setValue(next);
      }
      if (next !== targetRef.current) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // A reset is honoured in the same paint as the state change, not one frame
  // later once the effect has run. Waiting leaves a frame in which a shift that
  // has just started is drawn with the previous shift's full ring — which shows
  // up as the bead flashing round to the end and back.
  const jumped = target < valueRef.current || target - valueRef.current > JUMP;
  return jumped ? target : value;
}

export default function Dial({ progress = 0, state = 'idle', children }) {
  const over = progress > 1.001;
  const shown = Math.min(Math.max(progress, 0), 1);
  const done = state === 'complete';

  // A finished shift fills the ring regardless of the arithmetic. Everything
  // the dial draws comes off this one eased number.
  const filled = useEased(done ? 1 : shown);

  const arcLength = 2 * Math.PI * R;
  const glowLength = 2 * Math.PI * GLOW_R;

  // The bead is not positioned at the angle — it is parked at the start and the
  // group holding it is rotated. That matters: the arc's length is eased by a
  // CSS transition, so a bead placed at the true angle arrives before the arc
  // does and visibly detaches from the end of it. Rotating instead lets the
  // bead carry the identical transition, and the two stay welded together.
  const spin = filled * 360;

  const ticks = useMemo(() => {
    const out = [];
    for (let i = 0; i < TICKS; i += 1) {
      const a = (i / TICKS) * 2 * Math.PI + START;
      // Every fifth mark is heavier, which gives the scale a rhythm without
      // needing numbers on it.
      const major = i % 5 === 0;
      out.push({
        x1: MID + Math.cos(a) * TICK_INNER,
        y1: MID + Math.sin(a) * TICK_INNER,
        x2: MID + Math.cos(a) * TICK_OUTER,
        y2: MID + Math.sin(a) * TICK_OUTER,
        major,
        past: i / TICKS <= filled && filled > 0,
      });
    }
    return out;
  }, [filled]);

  return (
    <div className={`dial dial--${state}${over ? ' dial--over' : ''}`}>
      <svg className="dial__svg" viewBox={VIEW} aria-hidden="true">
        <defs>
          {/* The cylinder. See the note at the top of the file for why the
              stops are bunched up near offset 1. */}
          <radialGradient
            id="dialCylinder"
            cx={MID}
            cy={MID}
            r={GRADIENT_R}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.5" stopColor="var(--dial-arc-shade)" />
            <stop offset="0.5" stopColor="var(--dial-arc-body)" />
            <stop offset="0.97" stopColor="var(--dial-arc-rim)" />
            <stop offset="1" stopColor="var(--dial-arc-lip)" />
          </radialGradient>

          <filter id="dialArcShadow" x="-20%" y="-20%" width="140%" height="140%">
            {/* flood-color is set from the stylesheet rather than here: it has
                to follow the state class, and Firefox has been unreliable with
                var() inside a presentation attribute on this element. */}
            <feDropShadow className="dial__arc-shadow" dx="0" dy="3" stdDeviation="4" />
          </filter>
        </defs>

        {/* The scale, well outside the ring. */}
        <g className="dial__ticks">
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              strokeWidth={t.major ? 2.5 : 1.5}
              className={t.past ? 'is-past' : undefined}
            />
          ))}
        </g>

        {/* The groove. Always drawn in full, which is what keeps the idle dial
            reading as a dial rather than as empty space. */}
        <circle className="dial__track" cx={MID} cy={MID} r={R} strokeWidth={TRACK_STROKE} />

        {/* The glow. Its own radius, so it reads as light spilling off the
            outside of the arc rather than as a fatter arc. */}
        {filled > 0.002 && (
          <circle
            className="dial__glow"
            cx={MID}
            cy={MID}
            r={GLOW_R}
            strokeWidth={GLOW_STROKE}
            strokeDasharray={glowLength}
            strokeDashoffset={glowLength * (1 - filled)}
            transform={`rotate(${START_DEG} ${MID} ${MID})`}
          />
        )}

        <circle
          className="dial__arc"
          cx={MID}
          cy={MID}
          r={R}
          strokeWidth={ARC_STROKE}
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - filled)}
          transform={`rotate(${START_DEG} ${MID} ${MID})`}
        />

        {/* The disc the time sits on. Drawn in the SVG so it shares the same
            coordinate space as the ring and cannot drift out of centre. */}
        <circle className="dial__plate" cx={MID} cy={MID} r={PLATE_R} />

        {/* The leading edge: a pale bead with a coloured core, so the current
            position is findable at a glance on a bright screen. Drawn last so
            it rides over everything else. */}
        {filled > 0.002 && !done && (
          <g className="dial__pin-rotor" transform={`rotate(${spin} ${MID} ${MID})`}>
            <g className="dial__pin" transform={`translate(${MID} ${MID + PIN_R})`}>
              <circle className="dial__pin-outer" cx="0" cy="0" r="17" />
              <circle className="dial__pin-inner" cx="0" cy="0" r="7" />
            </g>
          </g>
        )}
      </svg>

      <div className="dial__face">{children}</div>
    </div>
  );
}
