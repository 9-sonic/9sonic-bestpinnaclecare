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
// Wave paths are expressed in objectBoundingBox units (0..1) rather than a
// viewBox, so one path scales to any width without preserveAspectRatio or
// pixel maths. Coordinates come from the Penpot boards, normalised to the
// visible slice of the artwork.
//
// The two screens do not share a curve: sign in drops steeply from the right
// and troughs near the middle, while profile is shallower and troughs further
// right, leaving room for the avatar to straddle it.
//
// Each curve drifts between a small loop of keyframe shapes (global.css,
// .wave__clip-path--signin / --profile) rather than sitting as one fixed path,
// so the crop line reads as water rather than a static cutout. That is a CSS
// @keyframes animation of the `d` property, not a library and not SVG SMIL:
// SMIL's `d` interpolation is patchy across engines, where animating `d` via
// CSS both works more consistently in the browsers this app actually ships to
// and, on anything old enough not to support it, simply does nothing —
// unsupported CSS properties are ignored, not broken, so it falls back to
// today's static wave rather than a visible glitch. It also inherits
// prefers-reduced-motion for free from the app's existing global rule
// (global.css line ~121), which forces every animation on the page to a
// single, near-instant frame; nothing extra was needed here for that.
const WAVE_PATHS = {
  signin: `M0,0 L1,0 L1,0.6001
    C1,0.6001 0.9812,0.7154 0.8995,0.8182
    C0.7945,0.9504 0.6059,1.0678 0.4346,0.9541
    C0.3338,0.8872 0.2603,0.8347 0.1976,0.8257
    C0.0597,0.806 0,0.9088 0,0.9088 Z`,
  profile: `M0,0 L1,0 L1,0.7636
    L0.97,0.8045 L0.8952,0.8773 L0.79,0.9364 L0.6522,0.9818
    C0.6522,0.9818 0.5609,1.0098 0.4466,0.9955
    C0.3315,0.981 0.2028,0.9353 0.1101,0.8773
    C0.1004,0.8712 0.0767,0.8528 0.0611,0.8364
    C0.0321,0.8058 0.0005,0.7752 0,0.7591 Z`,
};

export default function WaveHeader({ height = 210, photo = false, curve = 'signin', children }) {
  const clipId = useId();

  return (
    <div className="wave" style={{ height }}>
      {photo ? (
        <>
          <svg className="wave__clip" aria-hidden="true">
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                <path
                  className={`wave__clip-path wave__clip-path--${curve}`}
                  d={WAVE_PATHS[curve] ?? WAVE_PATHS.signin}
                />
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
