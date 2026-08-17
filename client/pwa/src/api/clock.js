import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toShifts } from './adapters.js';
import { newUuid, deviceFingerprint } from '../utils/ids.js';
import { toggleBreak as toggleLocalBreak, getBreak as getLocalBreak } from '../utils/breaks.js';
import { enqueue } from '../utils/offlineQueue.js';

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

// Derived from the visit list: whichever assignment is in progress.
export async function getClockStatus() {
  const res = env.useMock ? await mock.listVisits({}) : await api.get('/staff/visits', {});
  const active = toShifts(res).find((s) => s.status === 'active');
  return active ? { clockedIn: true, shift: active } : { clockedIn: false, shift: null };
}

// Breaks now reach the office: POST /staff/visit_assignments/:id/break records
// a break_start / break_end through the same append-only clock pipeline, so a
// break is idempotent on client_event_id and audited like any other event.
//
// Two things stay deliberately local:
//
//   The timer. The dial has to keep counting in a house with no signal, so the
//   device remains the display source and the server call rides alongside it.
//   The tap is never blocked on the network.
//
//   The decision to send. The endpoint uses on_block: :flag, so being out of
//   range flags the event rather than refusing it — a carer is never stopped
//   from taking a break by a geofence.
//
// `location` is the fix already captured at the clock tap, passed in by the
// caller. Breaks do not raise a fresh permission prompt: the carer is at the
// address they clocked in at, and re-asking mid-shift buys nothing.
export async function toggleBreak({ shiftId, location = null }) {
  const wasOnBreak = Boolean(getLocalBreak(shiftId).startedAt);
  const phase = wasOnBreak ? 'end' : 'start';

  // Flip the local timer first so the UI responds instantly and offline.
  const next = toggleLocalBreak(shiftId);

  if (env.useMock) return next;

  const event = buildClockEvent({ kind: phase === 'start' ? 'break_start' : 'break_end', location });

  try {
    await api.post(`/staff/visit_assignments/${shiftId}/break`, {
      phase,
      client_event_id: event.client_event_id,
      occurred_at: event.occurred_at,
      lat: event.lat,
      lng: event.lng,
      accuracy_m: event.accuracy_m,
    });
  } catch (error) {
    if (error?.isNetworkError) {
      // The clock outbox already carries break_start / break_end: they are
      // valid ClockEvent kinds and Sync::IngestBatch passes `kind` straight
      // through, so no second queue is needed. The timer stands either way.
      enqueue({ visitAssignmentId: shiftId, event });
      return next;
    }
    // A refusal is worth telling the carer about, but their break has still
    // started as far as the device is concerned — the timer is not rolled back.
    throw error;
  }

  return next;
}
