import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toShifts, toShift, toShiftDetail } from './adapters.js';
import { saveVisitLocal, clearVisitLocal, getVisitLocal, mergeVisitLocal } from '../utils/visitLocal.js';
import { newUuid } from '../utils/ids.js';

// The carer's own visits. The API returns visit assignments with the visit and
// the service user nested; adapters flattens them into the shift shape screens
// already use.

// `from` and `to` are ISO dates (YYYY-MM-DD). The API defaults to a seven day
// window starting today when they are omitted.
export async function listShifts({ from, to } = {}) {
  const res = env.useMock
    ? await mock.listVisits({ from, to })
    : await api.get('/staff/visits', { from, to });
  return toShifts(res);
}

const isoDate = (d) => d.toISOString().slice(0, 10);

// One assignment, with the care plan, task list and notes the Shift Detail
// screen needs. This used to pull a four week window and filter client side
// because no single-assignment route existed; it does now.
//
// The window fallback is kept for one reason: if the detail route is missing on
// the deployed API, a carer standing at a door still sees the address and the
// time rather than an error screen. It is a degraded view, not a silent one —
// the care plan and tasks come back empty.
export async function getShift(id) {
  // Same adapter as the live path: the mock now answers with the care plan,
  // tasks and notes the detail endpoint returns, so demo mode exercises the
  // whole screen rather than a version of it with two sections missing.
  if (env.useMock) return mergeVisitLocal(toShiftDetail(await mock.getVisit(id)));

  try {
    return mergeVisitLocal(toShiftDetail(await api.get(`/staff/visit_assignments/${id}`)));
  } catch (error) {
    if (error?.status !== 404) throw error;
    return mergeVisitLocal(await getShiftFromWindow(id));
  }
}

async function getShiftFromWindow(id) {
  const from = new Date();
  from.setDate(from.getDate() - 14);
  const to = new Date();
  to.setDate(to.getDate() + 14);

  const res = await api.get('/staff/visits', { from: isoDate(from), to: isoDate(to) });
  const match = (res ?? []).find((va) => String(va.id) === String(id));
  return match ? toShift(match) : null;
}

// Saves the carer's write-up and task ticks to the office.
//
// Two endpoints, because the API models them separately:
//   PATCH /staff/visit_assignments/:id/tasks  { tasks: [{ id, done }] }
//   POST  /staff/visit_assignments/:id/note   { body, client_note_id }
//
// The device copy is written first and only cleared once the server has both.
// A carer standing in a hallway with no signal must not lose what they typed,
// and must not be told it reached the office when it did not — the caller
// reads `synced` to decide which of those it says.
//
// The note is skipped when it is empty or unchanged from what the server
// already holds, so tapping Save twice does not append a second identical note.
// When it is sent, `client_note_id` is reused from the stored entry across
// retries, so a replay resolves to the same note rather than a duplicate.
export async function saveVisitNote({ shiftId, note, tasks, savedNote } = {}) {
  const pending = getVisitLocal(shiftId);
  const clientNoteId = pending?.clientNoteId ?? newUuid();
  const trimmed = (note ?? '').trim();
  const noteChanged = trimmed.length > 0 && trimmed !== (savedNote ?? '').trim();

  // Buffer first: if the request never lands, this is what survives.
  saveVisitLocal(shiftId, { note, tasks, clientNoteId });

  if (env.useMock) {
    await mock.saveVisitNote({ shiftId, note, tasks });
    clearVisitLocal(shiftId);
    return { synced: true };
  }

  try {
    if (tasks?.length) {
      await api.patch(`/staff/visit_assignments/${shiftId}/tasks`, {
        tasks: tasks.map((t) => ({ id: t.id, done: Boolean(t.done) })),
      });
    }
    if (noteChanged) {
      await api.post(`/staff/visit_assignments/${shiftId}/note`, {
        body: trimmed,
        client_note_id: clientNoteId,
      });
    }
  } catch (error) {
    // No signal: the buffer stands and the caller says so honestly. A refusal
    // from the server is different — the carer needs to know it failed.
    if (error?.isNetworkError) return { synced: false };
    throw error;
  }

  clearVisitLocal(shiftId);
  return { synced: true };
}
