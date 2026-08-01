import { useEffect, useState } from 'react';
import App from './App.jsx';
import SplashScreen from './components/common/SplashScreen.jsx';

const SPLASH_KEY = 'bpc.splash.shown';

// Shows the branded splash on a cold launch. Within a session we skip it so
// navigating around doesn't keep replaying the animation.
export default function Root() {
  const [showSplash, setShowSplash] = useState(
    () => sessionStorage.getItem(SPLASH_KEY) !== '1'
  );

  useEffect(() => {
    if (!showSplash) return;
    sessionStorage.setItem(SPLASH_KEY, '1');
  }, [showSplash]);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <App />
    </>
  );
}
