// ---------------------------------------------------------------------------
// Break timer — the on-device display.
//
// The break itself is recorded by the office now (api/clock.js posts
// break_start / break_end to POST /staff/visit_assignments/:id/break). This
// file is what the carer *sees*: the dial has to keep counting in a house with
// no signal, so the timer runs locally and the server call rides alongside it.
// A tap is never blocked on the network.
//
// So the two are not redundant — this is the running clock, the server holds
// the audited events. If they disagree, the server's events are the record.
//
// This used to live in the mock API. That looked harmless while everything was
// mocked, but the mock implementation looked the visit up in its own fixture
// table first — so against the real API, every break tap on a real visit threw
// "We could not find that."
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
