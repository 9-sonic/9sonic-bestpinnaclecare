// ---------------------------------------------------------------------------
// Visit notes and task ticks — the offline buffer.
//
// Both writes now reach the office: PATCH /staff/visit_assignments/:id/tasks
// and POST /staff/visit_assignments/:id/note. This file is no longer the only
// copy of a carer's write-up; it is the copy that has not been acknowledged
// yet.
//
// That distinction is the whole point. An entry here means "this device holds
// something the office has not confirmed", so it is written before the request
// goes out and cleared once the server accepts it. Carers work in houses with
// no signal, so a note typed at a door has to survive the walk back to the car.
//
// `clientNoteId` is minted once per unsent note and kept here verbatim. The
// note endpoint is idempotent on it (a replay hits the unique index and returns
// the existing note with 200), so retrying after a dropped connection cannot
// leave two copies of the same write-up in the record.
// ---------------------------------------------------------------------------

const KEY = 'bpc.local.visits';

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
    /* storage unavailable (private mode etc.) */
  }
}

export function getVisitLocal(shiftId) {
  return readAll()[String(shiftId)] ?? null;
}

export function saveVisitLocal(shiftId, { note, tasks, clientNoteId } = {}) {
  const id = String(shiftId);
  const all = readAll();
  all[id] = {
    ...(all[id] ?? {}),
    ...(note !== undefined ? { note } : null),
    ...(tasks !== undefined ? { tasks } : null),
    ...(clientNoteId !== undefined ? { clientNoteId } : null),
    savedAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[id];
}

// Called once the server has the write. Anything still here after this is
// genuinely unsent.
export function clearVisitLocal(shiftId) {
  const all = readAll();
  delete all[String(shiftId)];
  writeAll(all);
}

// Layers anything still unsent over what the server returned, so a carer who
// typed a note offline still sees it on reload.
export function mergeVisitLocal(shift) {
  if (!shift) return shift;
  const local = getVisitLocal(shift.id);
  if (!local) return shift;

  return {
    ...shift,
    visitNote: local.note ?? shift.visitNote,
    tasks: local.tasks ?? shift.tasks,
    // True when this device holds something the office has not been told about.
    hasUnsentLocalEdits: true,
  };
}
