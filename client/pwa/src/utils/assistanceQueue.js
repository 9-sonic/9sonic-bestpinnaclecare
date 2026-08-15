// The offline outbox for assistance requests (kind=clock_assistance).
//
// Separate from the clock queue on purpose: a different shape, a different
// endpoint, and no batch verdicts to resolve. A carer who cannot clock in is
// exactly the carer most likely to have no signal, so asking the office for
// help must not depend on the network either.
//
// Replay safety works the same way as clock events: `client_request_id` is
// minted once when the request is built, stored here verbatim, and sent again
// unchanged on every retry. api/requests.js preserves an id it is given, so a
// flushed request keeps its identity instead of becoming a duplicate.
//
// Items are stored exactly as createRequest wants them, so syncing is just
// posting each one back.

const QUEUE_KEY = 'bpc.assistance.queue';

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

function idOf(item) {
  return item?.payload?.client_request_id ?? null;
}

// `request` is the body for api/requests.js createRequest, already in API
// shape with payload.client_request_id set.
export function enqueue(request) {
  const items = read();
  // Guard against double submits queueing the same request twice.
  if (items.some((i) => idOf(i) === idOf(request))) return items.length;

  items.push({
    ...request,
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
export function toPayload(item) {
  const request = { ...item };
  delete request._attempts;
  delete request._queuedAt;
  return request;
}

// Removes a request the server accepted (or one that can never succeed).
export function remove(clientRequestId) {
  write(read().filter((i) => idOf(i) !== clientRequestId));
}

// Notes a failed attempt so a stuck request is visible in the stored data.
export function markAttempt(clientRequestId) {
  write(
    read().map((i) =>
      idOf(i) === clientRequestId ? { ...i, _attempts: (i._attempts ?? 0) + 1 } : i
    )
  );
}

export function clearQueue() {
  write([]);
}
