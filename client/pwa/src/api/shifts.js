import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toShifts, toShift } from './adapters.js';

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

// There is no endpoint for a single assignment, so this pulls a window around
// today and picks the one wanted. Listed in api_missing.md.
export async function getShift(id) {
  if (env.useMock) return toShift(await mock.getVisit(id));

  const from = new Date();
  from.setDate(from.getDate() - 14);
  const to = new Date();
  to.setDate(to.getDate() + 14);

  const res = await api.get('/staff/visits', { from: isoDate(from), to: isoDate(to) });
  const match = res.find((va) => String(va.id) === String(id));
  return match ? toShift(match) : null;
}

// Visit notes and task checklists have no endpoint yet, so this stays local.
export function saveVisitNote({ shiftId, note, tasks }) {
  return mock.saveVisitNote({ shiftId, note, tasks });
}
