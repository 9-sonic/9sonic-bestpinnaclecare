// ---------------------------------------------------------------------------
// Break timer — local only.
//
// The API models `break_minutes` on both the visit and the timesheet line, but
// nothing records a carer starting or ending a break, so there is nowhere to
// send this. Until there is (see gap 3 in suggestedMissingEndpoints.md) the
// Break button drives a timer on the device and the figure reaching the
// timesheet is the scheduled break, not the real one.
//
// This used to live in the mock API. That looked harmless while everything was
// mocked, but the mock implementation looked the visit up in its own fixture
// table first — so against the real API, every break tap on a real visit threw
// "We could not find that." Break state is genuinely local, so it belongs here
// rather than behind a fake endpoint.
// ---------------------------------------------------------------------------

const KEY = 'bpc.local.breaks';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeAll(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode etc.) - the timer just will not persist */
  }
}

export function getBreak(shiftId) {
  return readAll()[String(shiftId)] ?? { totalMs: 0, startedAt: null };
}

// Starts the break if stopped, stops it if running, and banks the elapsed time.
export function toggleBreak(shiftId) {
  const id = String(shiftId);
  const all = readAll();
  const current = all[id] ?? { totalMs: 0, startedAt: null };

  if (current.startedAt) {
    current.totalMs += Date.now() - new Date(current.startedAt).getTime();
    current.startedAt = null;
  } else {
    current.startedAt = new Date().toISOString();
  }

  all[id] = current;
  writeAll(all);
  return current;
}

export function clearBreak(shiftId) {
  const all = readAll();
  delete all[String(shiftId)];
  writeAll(all);
}
