import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { SW_UPDATE_EVENT, applyServiceWorkerUpdate } from '../../utils/swUpdate.js';

// Tells the carer when a new version has been downloaded, instead of silently
// leaving them on a stale app, or swapping it out mid-shift without warning.
export default function UpdatePrompt() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onUpdate = () => setReady(true);
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, []);

  if (!ready) return null;

  return (
    <div className="update-bar" role="status">
      <Icon name="sync" size={15} />
      <span>A new version is ready.</span>
      <button type="button" className="update-bar__btn" onClick={applyServiceWorkerUpdate}>
        Refresh
      </button>
      <button
        type="button"
        className="update-bar__close"
        onClick={() => setReady(false)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
