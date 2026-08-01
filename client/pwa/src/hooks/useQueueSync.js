import { useCallback, useEffect, useRef, useState } from 'react';
import { pushEvents } from '../api/sync.js';
import { queueSize, toPayload, resolve, peekQueue } from '../utils/offlineQueue.js';
import { useOnline } from './useOnline.js';
import { useToast } from '../context/ToastContext.jsx';

// Drains the offline clock queue whenever the device has a connection.
//
// Runs on mount, when the browser reports it is back online, and when the tab
// regains focus, since a phone waking in a carer's pocket often reconnects
// without firing an online event.
export function useQueueSync() {
  const online = useOnline();
  const toast = useToast();
  const [pending, setPending] = useState(queueSize);
  const running = useRef(false);

  const flush = useCallback(async () => {
    if (running.current) return;
    const items = peekQueue();
    if (items.length === 0) {
      setPending(0);
      return;
    }

    running.current = true;
    try {
      const res = await pushEvents(toPayload(items));
      const { accepted, rejected, remaining } = resolve(res?.results ?? []);
      setPending(remaining.length);

      if (accepted.length > 0) {
        toast.success(
          accepted.length === 1
            ? 'Offline clock event synced'
            : `${accepted.length} offline clock events synced`
        );
      }
      if (rejected.length > 0) {
        // The office needs to fix these by hand, so say so plainly.
        toast.error(
          `${rejected.length} clock ${rejected.length === 1 ? 'event' : 'events'} could not be saved. Tell your manager.`
        );
      }
    } catch {
      // Still no connection, or the server is down. The queue is untouched and
      // the next trigger will try again.
      setPending(queueSize());
    } finally {
      running.current = false;
    }
  }, [toast]);

  useEffect(() => {
    if (online) flush();
  }, [online, flush]);

  useEffect(() => {
    const onFocus = () => {
      if (navigator.onLine) flush();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [flush]);

  return { pending, flush };
}

export default useQueueSync;
