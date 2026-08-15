// Demo-mode implementations of the API.
//
// Each function returns exactly what the matching Rails endpoint returns, so
// the adapters and screens cannot tell the difference. Where the real API has
// no endpoint (visit notes, breaks, profile edits) the function is marked as
// local only and is listed in api_missing.md.

import { loadDb, saveDb, participantName as nameOf, carePlanFor, tasksFor } from './mockData.js';
import { ApiError } from '../api/client.js';

export { participantName } from './mockData.js';

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const MOCK_TOKEN = 'mock.jwt.not-a-real-token';

/* -------------------------------- Auth ---------------------------------- */

export async function login({ email }) {
  await delay(380);
  const db = loadDb();
  return {
    access: MOCK_TOKEN,
    employee: { ...db.employee, email: email || db.employee.email },
  };
}

export async function completeMfa() {
  await delay(300);
  return { access: MOCK_TOKEN, employee: loadDb().employee };
}

export async function fetchCurrentUser() {
  await delay(120);
  return loadDb().employee;
}

export async function logout() {
  await delay(80);
  return null;
}

export async function requestPasswordReset() {
  await delay(400);
  return null;
}

export async function resetPassword() {
  await delay(300);
  return null;
}

/* ------------------------------- Visits --------------------------------- */

const startOf = (va) => new Date(va.visit.scheduled_start);

export async function listVisits({ from, to } = {}) {
  await delay();
  const db = loadDb();
  let list = db.visit_assignments;

  if (from) {
    const f = new Date(`${from}T00:00:00`);
    list = list.filter((va) => startOf(va) >= f);
  }
  if (to) {
    const t = new Date(`${to}T23:59:59`);
    list = list.filter((va) => startOf(va) <= t);
  }

  return list.slice().sort((a, b) => startOf(a) - startOf(b));
}

// Mirrors GET /staff/visit_assignments/:id, which returns the assignment plus
// the care plan, the visit's tasks and its notes. Returning the bare assignment
// left the detail screen's care plan and task sections permanently empty in
// demo mode, so nobody could see or test them without a seeded API.
export async function getVisit(id) {
  await delay(150);
  const va = loadDb().visit_assignments.find((v) => String(v.id) === String(id));
  if (!va) throw new ApiError('We could not find that.', { status: 404, code: 'not_found' });

  const suId = va.visit?.service_user_id;
  return {
    ...va,
    care_plan: carePlanFor(suId),
    tasks: tasksFor(va.id, suId),
    notes: [],
  };
}

/* ------------------------------- Clocking -------------------------------- */

// Mirrors the server: idempotent on client_event_id, moves the lifecycle state,
// and answers with the same body shape the real endpoint returns.
export async function clock({ visitAssignmentId, event }) {
  await delay(420);
  const db = loadDb();
  const va = db.visit_assignments.find((v) => String(v.id) === String(visitAssignmentId));
  if (!va) throw new ApiError('We could not find that.', { status: 404, code: 'not_found' });

  db.seen_event_ids = db.seen_event_ids ?? [];
  if (db.seen_event_ids.includes(event.client_event_id)) {
    return {
      server_time: new Date().toISOString(),
      lifecycle_state: va.lifecycle_state,
      geofence: 'pass',
      distance_m: 0,
    };
  }

  if (event.kind === 'clock_in') {
    if (db.visit_assignments.some((v) => v.lifecycle_state === 'in_progress')) {
      throw new ApiError('That has already been recorded.', { status: 409, code: 'conflict' });
    }
    va.actual_start = event.occurred_at;
    va.lifecycle_state = 'in_progress';
  } else {
    if (va.lifecycle_state !== 'in_progress') {
      throw new ApiError('That has already been recorded.', { status: 409, code: 'conflict' });
    }
    va.actual_end = event.occurred_at;
    va.lifecycle_state = 'completed';
    va.worked_minutes = Math.max(
      1,
      Math.round((new Date(va.actual_end) - new Date(va.actual_start)) / 60000)
    );
  }

  db.seen_event_ids.push(event.client_event_id);
  saveDb(db);

  return {
    server_time: new Date().toISOString(),
    lifecycle_state: va.lifecycle_state,
    geofence: event.lat == null ? 'no_fix' : 'pass',
    distance_m: event.lat == null ? null : 24,
  };
}

/* --------------------------------- Sync ---------------------------------- */

export async function syncEvents(events = []) {
  await delay(500);
  const results = [];
  for (const e of events) {
    try {
      await clock({ visitAssignmentId: e.visit_assignment_id, event: e });
      results.push({ client_event_id: e.client_event_id, status: 'accepted', geofence: 'pass' });
    } catch {
      results.push({ client_event_id: e.client_event_id, status: 'rejected', geofence: null });
    }
  }
  return { results };
}

export async function syncChanges(since) {
  await delay(300);
  const db = loadDb();
  const open = db.visit_assignments.filter(
    (va) => !['completed', 'missed', 'cancelled'].includes(va.lifecycle_state)
  );
  return {
    server_time: new Date().toISOString(),
    cursor: since ?? new Date().toISOString(),
    visits: open,
  };
}

/* ------------------------------ Timesheet -------------------------------- */

export async function getTimesheet() {
  await delay(260);
  return loadDb().timesheet_lines;
}

export async function raiseDispute({ timesheetLineId, reason }) {
  await delay(300);
  return { id: Date.now(), timesheet_line_id: timesheetLineId, reason, state: 'open' };
}

/* ---------------------------- Notifications ------------------------------ */

export async function listNotifications() {
  await delay(200);
  return loadDb().notifications;
}

export async function markNotificationSeen(id) {
  const db = loadDb();
  const n = db.notifications.find((x) => String(x.id) === String(id));
  if (n) n.seen_at = new Date().toISOString();
  saveDb(db);
  return null;
}

export async function markAllNotificationsRead() {
  const db = loadDb();
  const now = new Date().toISOString();
  db.notifications = db.notifications.map((n) => ({ ...n, seen_at: n.seen_at ?? now }));
  saveDb(db);
  return { ok: true };
}

export async function getNotificationPreferences() {
  await delay(150);
  return loadDb().notification_preferences;
}

export async function updateNotificationPreferences(patch) {
  const db = loadDb();
  db.notification_preferences = db.notification_preferences.map((p) =>
    p.notification_type === patch.notification_type ? { ...p, ...patch } : p
  );
  saveDb(db);
  return db.notification_preferences;
}

/* -------------------------------- Chat ----------------------------------- */

export async function listConversations() {
  await delay(220);
  const db = loadDb();
  return db.conversations
    .slice()
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
}

export async function listMessages(conversationId) {
  await delay(180);
  return loadDb().messages[conversationId] ?? [];
}

export async function sendMessage({ threadId, body, client_message_id: clientMessageId }) {
  await delay(140);
  const db = loadDb();
  const message = {
    id: Date.now(),
    conversation_id: Number(threadId),
    sender_type: 'Employee',
    sender_id: db.employee.id,
    body,
    client_message_id: clientMessageId,
    created_at: new Date().toISOString(),
    edited_at: null,
    deleted_at: null,
  };
  db.messages[threadId] = [...(db.messages[threadId] ?? []), message];
  const convo = db.conversations.find((c) => String(c.id) === String(threadId));
  if (convo) convo.last_message_at = message.created_at;
  saveDb(db);
  return message;
}

export async function markThreadRead(messageId) {
  const db = loadDb();
  const convoId = Object.keys(db.messages).find((cid) =>
    db.messages[cid].some((m) => String(m.id) === String(messageId))
  );
  const convo = db.conversations.find((c) => String(c.id) === String(convoId));
  if (convo) convo.unread_count = 0;
  saveDb(db);
  return null;
}

export async function createConversation({ participants, title, kind }) {
  await delay(200);
  const db = loadDb();
  const convo = {
    id: Date.now(),
    kind,
    title: title ?? null,
    direct_key: kind === 'direct' ? `mock-${Date.now()}` : null,
    last_message_at: null,
    unread_count: 0,
    participants,
  };
  db.conversations.unshift(convo);
  db.messages[convo.id] = [];
  saveDb(db);
  return convo;
}

/* ------------------- Local only, no API endpoint yet ---------------------- */

// Mirrors PATCH /staff/me: the same camelCase patch goes in, and what comes
// back is shaped like an Employee from the API. If this stored the patch keys
// verbatim the mock would round-trip fields the live path cannot, and the two
// would drift apart without anything failing.
export async function updateProfile(patch) {
  await delay(320);
  const db = loadDb();

  db.employee = {
    ...db.employee,
    ...(patch.emergencyContactName !== undefined
      ? { emergency_contact_name: patch.emergencyContactName }
      : null),
    ...(patch.emergencyContactPhone !== undefined
      ? { emergency_contact_phone: patch.emergencyContactPhone }
      : null),
  };

  if (patch.name) {
    const [first, ...rest] = patch.name.split(' ');
    db.employee.first_name = first;
    db.employee.last_name = rest.join(' ');
    db.employee.full_name = patch.name;
  }
  saveDb(db);
  return db.employee;
}

export async function getAvailability() {
  await delay(180);
  return loadDb().local?.availability ?? null;
}

export async function updateAvailability(availability) {
  await delay(280);
  const db = loadDb();
  db.local.availability = availability;
  saveDb(db);
  return availability;
}

export async function saveVisitNote({ shiftId, note, tasks }) {
  await delay(280);
  const db = loadDb();
  db.local.visitNotes[shiftId] = note;
  if (tasks) db.local.tasks[shiftId] = tasks;
  saveDb(db);
  return { ok: true };
}

export async function toggleBreak({ shiftId }) {
  await delay(180);
  const db = loadDb();
  const va = db.visit_assignments.find((v) => String(v.id) === String(shiftId));
  if (!va) throw new ApiError('We could not find that.', { status: 404, code: 'not_found' });

  const current = db.local.breaks[shiftId] ?? { totalMs: 0, startedAt: null };
  if (current.startedAt) {
    current.totalMs += Date.now() - new Date(current.startedAt).getTime();
    current.startedAt = null;
  } else {
    current.startedAt = new Date().toISOString();
  }
  db.local.breaks[shiftId] = current;
  saveDb(db);
  return va;
}

export function readLocal() {
  return loadDb().local;
}

/* ------------------- Carer requests (for clock assistance etc.) ----------- */

export async function listMyRequests() {
  await delay(150);
  const db = loadDb();
  return db.carer_requests || [];
}

export async function createRequest({ kind, summary, detail, payload }) {
  await delay(220);
  const db = loadDb();
  const req = {
    id: Date.now(),
    employee_id: db.employee?.id || 1,
    employee_name: db.employee?.full_name || null,
    kind,
    state: 'pending',
    summary,
    detail: detail || null,
    payload: payload || {},
    decided_by: null,
    decision_note: null,
    decided_at: null,
    created_at: new Date().toISOString(),
  };
  if (!db.carer_requests) db.carer_requests = [];
  db.carer_requests.unshift(req);
  saveDb(db);
  return req;
}

export { nameOf };
