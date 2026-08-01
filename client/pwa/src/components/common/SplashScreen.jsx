import { useEffect, useState } from 'react';

// Branded launch screen shown while the app boots (auth restore, first chunk
// load). Inherits the active theme so a dark mode user never gets a white flash.
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
      <div className="splash__inner">
        <img className="splash__logo" src="/logo.png" alt="Best Pinnacle Care" />
        <div className="splash__bar">
          <span className="splash__bar-fill" />
        </div>
      </div>
      <p className="splash__tagline">Here For You</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
