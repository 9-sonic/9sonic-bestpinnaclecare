import { useCallback, useEffect, useRef, useState } from 'react';
import { createRequest } from '../api/requests.js';
import { queueSize, peekQueue, toPayload, remove, markAttempt } from '../utils/assistanceQueue.js';
import { useOnline } from './useOnline.js';
import { useToast } from '../context/ToastContext.jsx';

// Drains the offline assistance-request queue whenever the device has a
// connection.
//
// Mirrors useQueueSync, but posts requests one at a time because
// /staff/requests has no batch endpoint with per-item verdicts. A network
// failure stops the loop — everything still queued keeps its place for the
// next trigger. A 4xx rejection is dropped for the same reason the clock
// queue drops rejected events: replaying it would fail identically forever,
// and it is surfaced so the office can be told.
export function useAssistanceQueueSync() {
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
    const sent = [];
    const rejected = [];
    try {
      for (const item of items) {
        const id = item.payload?.client_request_id;
        try {
          await createRequest(toPayload(item));
          remove(id);
          sent.push(item);
        } catch (err) {
          if (err?.isNetworkError) break; // No connection: stop, keep the rest.
          if (err?.status && err.status >= 400 && err.status < 500) {
            remove(id);
            rejected.push(item);
          } else {
            markAttempt(id); // 5xx or unknown: leave it for the next attempt.
          }
        }
      }

      setPending(queueSize());

      if (sent.length > 0) {
        toast.success(
          sent.length === 1
            ? 'Assistance request sent to the office'
            : `${sent.length} assistance requests sent to the office`
        );
      }
      if (rejected.length > 0) {
        // The office needs to fix these by hand, so say so plainly.
        toast.error(
          `${rejected.length} assistance ${rejected.length === 1 ? 'request' : 'requests'} could not be sent. Tell your manager.`
        );
      }
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

export default useAssistanceQueueSync;
