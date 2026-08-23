import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { newUuid } from '../utils/ids.js';

// Carer requests. POST /api/v1/staff/requests and GET /api/v1/staff/requests.
//
// KIND: `drop` is the only kind a carer raises — declining a visit for cover.
// The server records every request as a drop regardless of what's sent, so the
// other historic kinds (swap/overtime/availability/leave) are gone from the app.
//
// Declining a visit (ShiftDetailPage) is the drop path.
// Clock-assistance context (visit, attempted_at, error_code, distance, lat/lng,
// device_fingerprint) travels in the flexible `payload` jsonb, and every request
// carries a `client_request_id` for idempotency — the PWA offline queue keys on
// it, and the backend can add a unique index later for safe replays.

export async function listMyRequests() {
  const res = env.useMock
    ? await mock.listMyRequests()
    : await api.get('/staff/requests');
  return Array.isArray(res) ? res : [];
}

// `client_request_id` is preserved when the caller already minted one — the
// offline queue does exactly that, so a queued request replayed after a dropped
// connection keeps its identity instead of becoming a duplicate.
export async function createRequest({ kind, summary, detail, payload = {} }) {
  const body = {
    kind,
    summary,
    detail: detail || null,
    payload: {
      ...payload,
      client_request_id: payload.client_request_id ?? newUuid(),
    },
  };

  const res = env.useMock
    ? await mock.createRequest(body)
    : await api.post('/staff/requests', body);

  return res;
}
