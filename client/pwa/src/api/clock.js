import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toShifts } from './adapters.js';
import { newUuid, deviceFingerprint } from '../utils/ids.js';
import { toggleBreak as toggleLocalBreak } from '../utils/breaks.js';

// Clocking is keyed on the visit assignment, and every event carries a
// client-generated UUID. The server treats that UUID as the identity of the
// event, so a retry after a dropped connection creates nothing new: the same
// tap can be sent as many times as needed.

// Built once so the live call and the offline queue send exactly the same body.
export function buildClockEvent({ kind, location, occurredAt }) {
  return {
    kind,
    client_event_id: newUuid(),
    occurred_at: occurredAt ?? new Date().toISOString(),
    lat: location?.latitude ?? null,
    lng: location?.longitude ?? null,
    accuracy_m: location?.accuracy != null ? Math.round(location.accuracy) : null,
    device_fingerprint: deviceFingerprint(),
  };
}

// Sends one event. Throws ApiError with code "too_far" when the carer is
// outside the geofence, which the caller turns into a prompt.
export async function sendClockEvent({ visitAssignmentId, event }) {
  if (env.useMock) return mock.clock({ visitAssignmentId, event });
  return api.post(`/staff/visit_assignments/${visitAssignmentId}/clock`, event);
}

export function clockIn({ shiftId, location }) {
  return sendClockEvent({
    visitAssignmentId: shiftId,
    event: buildClockEvent({ kind: 'clock_in', location }),
  });
}

export function clockOut({ shiftId, location }) {
  return sendClockEvent({
    visitAssignmentId: shiftId,
    event: buildClockEvent({ kind: 'clock_out', location }),
  });
}

// Derived from the visit list: whichever assignment is in progress.
export async function getClockStatus() {
  const res = env.useMock ? await mock.listVisits({}) : await api.get('/staff/visits', {});
  const active = toShifts(res).find((s) => s.status === 'active');
  return active ? { clockedIn: true, shift: active } : { clockedIn: false, shift: null };
}

// Breaks are not modelled in the API. The schema carries break_minutes on the
// visit and the timesheet line, but nothing records a carer starting one, so
// this stays on the device. See gap 3 in suggestedMissingEndpoints.md.
//
// Identical on both paths deliberately: the previous version went through the
// mock API, which looked the visit up in its fixture table and threw a 404 for
// any real visit id — so the Break button was broken the moment the app pointed
// at a live API.
export async function toggleBreak({ shiftId }) {
  return toggleLocalBreak(shiftId);
}
