import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';

// Offline outbox. Queued clock events go up in one batch and the server answers
// with a per-event result, so the client knows exactly which ones landed.
//
// Every event is idempotent on client_event_id, so replaying a whole batch
// after a partial failure is safe.
export function pushEvents(events) {
  if (env.useMock) return mock.syncEvents(events);
  return api.post('/staff/sync/events', { events });
}

// Visits to cache for offline use, including the service user's coordinates so
// the device can do a provisional geofence check with no signal.
export function pullChanges(since) {
  if (env.useMock) return mock.syncChanges(since);
  return api.get('/staff/sync/changes', { since });
}
