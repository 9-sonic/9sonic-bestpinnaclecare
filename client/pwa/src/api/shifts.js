import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toShifts, toShift, toShiftDetail } from './adapters.js';
import { saveVisitLocal, mergeVisitLocal } from '../utils/visitLocal.js';

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
  if (env.useMock) return mergeVisitLocal(toShift(await mock.getVisit(id)));

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

// Visit notes and task checklists still have no write endpoint — the detail
// route reads them, nothing accepts them back. Saved on the device and layered
// back over the server's copy on read, so a carer's write-up does not disappear
// on reload. It does not reach the office. See gap 2 in
// suggestedMissingEndpoints.md; this goes away when the two writes exist.
export async function saveVisitNote({ shiftId, note, tasks }) {
  return saveVisitLocal(shiftId, { note, tasks });
}
