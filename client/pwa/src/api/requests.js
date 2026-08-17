import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { newUuid } from '../utils/ids.js';

// Carer requests. POST /api/v1/staff/requests and GET /api/v1/staff/requests.
//
// KIND WARNING: the server validates `kind` against CarerRequest::KINDS, which
// is swap / drop / overtime / availability / leave. `clock_assistance` is NOT
// in that list, so AssistanceRequestDialog's request is refused with 422
// validation_failed against a real API. The Playwright suite does not catch it
// because it runs in mock mode. Either the backend adds the kind or the dialog
// picks an existing one — raised with Ian, not worked around here, because
// silently relabelling an urgent "I cannot clock in" as a shift `drop` would
// tell the office something untrue.
//
// Declining a visit (ShiftDetailPage) uses `drop`, which is a real kind.
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
