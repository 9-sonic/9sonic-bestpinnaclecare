import { useId } from 'react';

// The teal header used by the sign in and password screens.
//
// Two variants:
//
// - default (vector): three overlapping curves rather than one. The design has
//   a dark teal field with two lighter ribbons sweeping across it, which is what
//   stops it reading as a flat coloured block. They are separate paths at
//   different opacities so the overlaps deepen the colour on their own.
//   preserveAspectRatio is set to slice so the artwork fills any width without
//   the curve flattening out on a tablet.
//
// - photo: the illustrated wallpaper, shown full width with a band of layered,
//   drifting waves along the bottom edge (.onde below) rather than a single
//   fixed curve cropped out of the photo. This is the same file the splash
//   screen shows, so on the launch path it is already decoded and the header
//   paints immediately. Opt in per page; the vector stays the default so the
//   other headers that use this component are unaffected.
//
// The wave band is the classic layered-parallax-ocean technique: one wave
// shape, drawn once, repeated with <use> at a few vertical offsets and
// opacities, each drifting sideways on its own loop via CSS transform. Chosen
// over the single-curve clip-path this used to be specifically because it was
// tried and looked wrong — flagged directly rather than reworked quietly. It
// is also cheaper: transform is a compositor-only property, so every layer
// animates on the GPU with no per-frame repaint, unlike the earlier version's
// clip-path shape morph, which had to repaint the clipped region on every
// frame. See global.css (.onde, .onde__layer) for the animation itself.
export default function WaveHeader({ height = 210, photo = false, children }) {
  const waveId = useId();

  return (
    <div className="wave" style={{ height }}>
      {photo ? (
        <>
          <img
            className="wave__photo"
            src="/brand/wallpaper.webp"
            alt=""
            aria-hidden="true"
          />
          <svg
            className="onde"
            viewBox="0 24 150 28"
            preserveAspectRatio="none"
            shapeRendering="auto"
            aria-hidden="true"
          >
            <defs>
              <path
                id={waveId}
                d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352Z"
              />
            </defs>
            {/* href alone is enough for Chrome and Firefox, but Safari has
                lagged on plain (non-namespaced) href resolving on <use> — MDN
                flags this directly and recommends setting both. Without
                xlinkHref too, a <use> whose reference doesn't resolve renders
                nothing at all: no shape, not a wrong colour, nothing. That
                matches "the wave doesn't show up on iOS" exactly, so both
                attributes are set rather than relying on href alone. */}
            <g className="onde__parallax">
              <use href={`#${waveId}`} xlinkHref={`#${waveId}`} x="48" y="0" className="onde__layer onde__layer--1" />
              <use href={`#${waveId}`} xlinkHref={`#${waveId}`} x="48" y="3" className="onde__layer onde__layer--2" />
              <use href={`#${waveId}`} xlinkHref={`#${waveId}`} x="48" y="5" className="onde__layer onde__layer--3" />
              <use href={`#${waveId}`} xlinkHref={`#${waveId}`} x="48" y="7" className="onde__layer onde__layer--4" />
            </g>
          </svg>
        </>
      ) : (
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
      )}

      {children && <div className="wave__content">{children}</div>}
    </div>
  );
}
