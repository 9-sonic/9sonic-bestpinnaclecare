import { useEffect } from 'react';
import { subscribeInbox } from '../api/cable.js';

// Runs `onChange` when the office changes this carer's rota over the socket, so
// the calendar updates live instead of only on the next open/poll.
//
// Notifications::ShiftChanged broadcasts { type: 'shift' } to the same
// InboxChannel address as chat/notifications — a bare "your rota changed"
// signal with no payload. Like the notifications hook, this refetches rather
// than trying to patch state from the message: the shift list has its own
// shape and ordering, and one source of truth is worth an extra request. It
// fires on any change (new/moved/reassigned/withdrawn/cancelled shift).
export function useShiftUpdates(onChange) {
  useEffect(
    () =>
      subscribeInbox((payload) => {
        if (payload?.type === 'shift') onChange();
      }),
    [onChange]
  );
}

export default useShiftUpdates;
