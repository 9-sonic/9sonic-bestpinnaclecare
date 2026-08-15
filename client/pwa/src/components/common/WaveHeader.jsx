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
// - photo: the illustrated wallpaper, cropped to its bottom section (the dunes)
//   and cut off by the wave. This is the same file the splash screen shows, so
//   on the launch path it is already decoded and the header paints immediately.
//   Opt in per page; the vector stays the default so the other headers that use
//   this component are unaffected.
//
// The wave path is expressed in objectBoundingBox units (0..1) rather than a
// viewBox, so one path scales to any width without preserveAspectRatio or
// pixel maths. Its coordinates come from the Penpot board, normalised to the
// visible slice of the artwork.
const WAVE_PATH = `M0,0 L1,0 L1,0.6001
  C1,0.6001 0.9812,0.7154 0.8995,0.8182
  C0.7945,0.9504 0.6059,1.0678 0.4346,0.9541
  C0.3338,0.8872 0.2603,0.8347 0.1976,0.8257
  C0.0597,0.806 0,0.9088 0,0.9088 Z`;

export default function WaveHeader({ height = 210, photo = false, children }) {
  const clipId = useId();

  return (
    <div className="wave" style={{ height }}>
      {photo ? (
        <>
          <svg className="wave__clip" aria-hidden="true">
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                <path d={WAVE_PATH} />
              </clipPath>
            </defs>
          </svg>
          <img
            className="wave__photo"
            src="/brand/wallpaper.webp"
            alt=""
            aria-hidden="true"
            style={{ clipPath: `url(#${clipId})` }}
          />
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
