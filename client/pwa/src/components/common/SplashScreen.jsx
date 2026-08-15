import { useEffect, useState } from 'react';

// Branded launch screen shown while the app boots (auth restore, first chunk
// load).
//
// The artwork is the same file the sign in header uses, so by the time the user
// reaches /login it is already decoded and cached and the header paints with no
// load-in. Keep both pointing at brand/wallpaper.webp.
//
// The illustration is dark in both themes by design, so this screen does not
// follow the theme the way the rest of the app does. #boot in index.html paints
// the same teal underneath, which is what stops a flash on a cold start.
export default function SplashScreen({ onDone, minDuration = 900 }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), minDuration);
    const done = setTimeout(() => onDone?.(), minDuration + 340);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [minDuration, onDone]);

  return (
    <div className={`splash${leaving ? ' splash--leaving' : ''}`} role="status">
      <img className="splash__logo" src="/brand/logo-mono.webp" alt="Best Pinnacle Care" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
