// ---------------------------------------------------------------------------
// Visit notes and task ticks — local only, for now.
//
// GET /staff/visit_assignments/:id returns the care plan, the task list and the
// notes. Nothing accepts them back: there is no write endpoint for either (gap
// 2 in suggestedMissingEndpoints.md).
//
// So a carer ticking off medication or writing up a visit is recording it on
// their own phone, and the office cannot see it. That is bad, and it is called
// out for Ian. What this file prevents is the worse version: before it, the
// note was written into the mock fixture store and never read back on the live
// path, so it vanished on reload and looked to the carer like the app had
// thrown their write-up away.
//
// Local values are layered over the server's on read, so what a carer typed
// stays on their screen. The moment the write endpoints exist, this whole file
// and the merge in getShift come out.
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

export function saveVisitLocal(shiftId, { note, tasks }) {
  const id = String(shiftId);
  const all = readAll();
  all[id] = {
    ...(all[id] ?? {}),
    ...(note !== undefined ? { note } : null),
    ...(tasks !== undefined ? { tasks } : null),
    savedAt: new Date().toISOString(),
  };
  writeAll(all);
  return { ok: true };
}

// Layers anything saved on this device over what the server returned.
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
