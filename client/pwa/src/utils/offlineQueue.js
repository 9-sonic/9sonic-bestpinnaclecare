// The offline outbox for clock events.
//
// Carers work in people's homes, often with no signal, so a clock in must never
// depend on the network. The tap is written here first with the time it
// happened, then uploaded whenever a connection appears.
//
// Two things make this safe to replay:
//
//   occurred_at      the moment the carer tapped, set on the device. The server
//                    records this, not the arrival time, so the attendance
//                    record reflects the real visit even if the phone syncs
//                    hours later.
//   client_event_id  a UUID minted per tap. The server treats it as the
//                    identity of the event, so sending the same one twice
//                    changes nothing. This is what stops a retry turning into
//                    a duplicate shift.
//
// Events are stored exactly as the API wants them, so syncing is just posting
// the array back.

const QUEUE_KEY = 'bpc.clock.queue';

function read() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* storage full or unavailable; the caller still gets the in-memory result */
  }
}

// `event` is the body built by api/clock.js, already in API shape.
export function enqueue({ visitAssignmentId, event }) {
  const items = read();
  // Guard against double taps queueing the same event twice.
  if (items.some((i) => i.client_event_id === event.client_event_id)) return items.length;

  items.push({
    visit_assignment_id: Number(visitAssignmentId),
    kind: event.kind,
    client_event_id: event.client_event_id,
    occurred_at: event.occurred_at,
    lat: event.lat,
    lng: event.lng,
    accuracy_m: event.accuracy_m,
    device_fingerprint: event.device_fingerprint,
    // Local bookkeeping, stripped before upload.
    _attempts: 0,
    _queuedAt: new Date().toISOString(),
  });

  write(items);
  return items.length;
}

export function queueSize() {
  return read().length;
}

export function peekQueue() {
  return read();
}

// Strips the local bookkeeping fields the API does not expect.
export function toPayload(items = read()) {
   
  return items.map(({ _attempts, _queuedAt, ...event }) => event);
}

// Removes the events the server confirmed. Anything it rejected outright is
// also dropped, since replaying it would fail identically forever; the failure
// is surfaced to the caller so it can be reported.
export function resolve(results = []) {
  const byId = new Map(results.map((r) => [r.client_event_id, r.status]));
  const remaining = [];
  const accepted = [];
  const rejected = [];

  read().forEach((item) => {
    const status = byId.get(item.client_event_id);
    if (status === 'accepted' || status === 'duplicate' || status === 'replay') {
      accepted.push(item);
    } else if (status === 'rejected' || status === 'invalid') {
      rejected.push(item);
    } else {
      // No verdict for this one, so keep it for the next attempt.
      remaining.push({ ...item, _attempts: (item._attempts ?? 0) + 1 });
    }
  });

  write(remaining);
  return { accepted, rejected, remaining };
}

export function clearQueue() {
  write([]);
}
