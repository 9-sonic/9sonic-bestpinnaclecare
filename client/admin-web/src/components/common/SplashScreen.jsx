import { useEffect, useState } from 'react';

// Branded boot splash — mirrors the carer PWA's launch screen so the two apps
// read as one product: the mono logo over the brand wallpaper, held briefly,
// then faded out. Shown while the admin app restores auth on a cold start.
export default function SplashScreen({ onDone, minDuration = 800 }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), minDuration);
    const done = setTimeout(() => onDone?.(), minDuration + 340);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, [minDuration, onDone]);

  return (
    <div className={`admin-splash${leaving ? ' admin-splash--leaving' : ''}`} role="status">
      <img className="admin-splash__logo" src="/brand/logo-mono.webp" alt="Best Pinnacle Care" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
