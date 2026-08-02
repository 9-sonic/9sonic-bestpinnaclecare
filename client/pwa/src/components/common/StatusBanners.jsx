import { useEffect, useState } from 'react';
import { useOnline } from '../../hooks/useOnline.js';
import { queueSize } from '../../utils/offlineQueue.js';
import Icon from './Icon.jsx';

// Connectivity status only. These strips appear when there is something the
// carer genuinely needs to know: they are offline, or clock events are still
// waiting to reach the server. Demo mode is signposted on the sign in screen
// instead, so it does not take up room on every page.
export default function StatusBanners() {
  const online = useOnline();
  const [pending, setPending] = useState(queueSize);

  useEffect(() => {
    const check = () => setPending(queueSize());
    window.addEventListener('online', check);
    window.addEventListener('focus', check);
    const interval = setInterval(check, 5000);
    return () => {
      window.removeEventListener('online', check);
      window.removeEventListener('focus', check);
      clearInterval(interval);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div className="status-strips">
      {!online && (
        <div className="strip strip--offline" role="status">
          <Icon name="offline" size={14} />
          Offline. Clock ins are saved and will sync.
        </div>
      )}
      {online && pending > 0 && (
        <div className="strip strip--sync" role="status">
          <Icon name="sync" size={14} />
          Syncing {pending} clock {pending === 1 ? 'event' : 'events'}
        </div>
      )}
    </div>
  );
}
