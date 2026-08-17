import { useEffect } from 'react';
import { subscribeInbox } from '../api/cable.js';

// Runs `onNotification` when the office sends a notification over the socket.
//
// Notifications::Deliver broadcasts { type: 'notification', notification } to
// the same InboxChannel address as chat messages. Every subscriber in the app
// used to filter for type === 'message' and drop the rest, so a notification
// only surfaced on the next poll or navigation — the carer could be looking
// straight at the screen and not see it arrive.
//
// Screens that display notifications use this to refetch. It is deliberately a
// refetch rather than appending the payload: the list has its own ordering and
// seen-state, and one source of truth for it is worth an extra request.
export function useInboxNotifications(onNotification) {
  useEffect(
    () =>
      subscribeInbox((payload) => {
        if (payload?.type === 'notification') onNotification(payload.notification);
      }),
    [onNotification]
  );
}

export default useInboxNotifications;
