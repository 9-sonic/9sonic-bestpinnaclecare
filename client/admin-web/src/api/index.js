import api from './client.js';
import env from '../config/env.js';
import { getToken } from '../utils/storage.js';

// One module for the office endpoints. Each function is a single live call to
// the Rails API — the admin console always talks to the real backend.

// Multipart upload (files) — bypasses the JSON client so the browser sets the
// multipart boundary. Same bearer auth.
async function apiUpload(path, formData, method = 'POST') {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method, headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
  });
  if (!res.ok) {
    let err; try { err = await res.json(); } catch { /* non-json */ }
    throw new Error(err?.error || 'Upload failed');
  }
  return res.json();
}

// Admin list endpoints are paginated ({ items, page, per_page, total }). Two
// shapes of caller:
//   • list*(...)  — pickers, feeds and search that want every row: fetch a large
//     page and return the plain array (unwrapping items) so existing callers are
//     unchanged.
//   • page*(...)  — the list pages that show Prev/Next: pass { page, per_page }
//     and get the full { items, total, page, per_page } object back.
const FULL_PAGE = 500;
const unwrap = (res) => (Array.isArray(res) ? res : (res?.items ?? []));

/* --------------------------------- Auth ---------------------------------- */

export const login = ({ email, password }) =>
  api.post('/admin/auth/login', { email, password }, { auth: false });

export const completeMfa = ({ mfaToken, otpCode }) =>
  api.post('/auth/mfa', { mfa_token: mfaToken, otp_code: otpCode }, { auth: false });

export const fetchCurrentAdmin = () => api.get('/admin/me');
export const logout = () => api.delete('/auth/logout');

export const beginMfaEnrolment = () => api.post('/admin/mfa');
export const confirmMfaEnrolment = (otpCode) => api.post('/admin/mfa/confirm', { otp_code: otpCode });

export const requestPasswordReset = (email) =>
  api.post('/admin/auth/password', { email }, { auth: false });

// Set a password from an invite or reset token — the same PUT serves both.
export const setPassword = ({ token, password }) =>
  api.put('/admin/auth/password', { token, password }, { auth: false });

/* ---------------------------- Team (office admins) ------------------------ */

export const listAdmins = () => api.get('/admin/admins', { per_page: FULL_PAGE }).then(unwrap);
export const pageAdmins = ({ page = 1, per_page = 25 } = {}) => api.get('/admin/admins', { page, per_page });
export const inviteAdmin = (attrs) => api.post('/admin/admins', attrs);
export const updateAdmin = (id, payload) => api.patch(`/admin/admins/${id}`, payload);
export const resendAdminInvite = (id) => api.post(`/admin/admins/${id}/resend_invite`);

/* ------------------------------ Monitoring -------------------------------- */

export const getDashboard = () => api.get('/admin/dashboard');
export const getLiveBoard = () => api.get('/admin/live_board');
export const getExceptions = () => api.get('/admin/exceptions');

// Append-only Event audit log (read-only): who did what, when and why.
// Filters: event_type, aggregate_type, aggregate_id, actor_type, actor_id,
// from, to, before (cursor), limit.
export const listAudit = (params = {}) => api.get('/admin/audit', params);

// Sign-in history (read-only): every login try, success or failure, with IP
// and device info. Filters: resource_type, resource_id, success, from, to.
export const listLoginAttempts = (params = {}) => api.get('/admin/login_attempts', params);

// Clocking-performance aggregates over a date range.
export const getReports = (params = {}) => api.get('/admin/reports', params);

// Cover: unfilled visits + offers.
export const getCover = () => api.get('/admin/cover');
export const createCoverOffer = (visitId, employeeId, note) =>
  api.post('/admin/cover_offers', { visit_id: visitId, employee_id: employeeId, note });
export const acceptCoverOffer = (id) => api.post(`/admin/cover_offers/${id}/accept`);
export const declineCoverOffer = (id) => api.post(`/admin/cover_offers/${id}/decline`);

// Carer requests queue.
export const listRequests = (params = {}) => api.get('/admin/requests', { per_page: FULL_PAGE, ...params }).then(unwrap);
export const pageRequests = ({ page = 1, per_page = 25, ...params } = {}) => api.get('/admin/requests', { page, per_page, ...params });
export const approveRequest = (id, note) => api.post(`/admin/requests/${id}/approve`, { note });
export const declineRequest = (id, note) => api.post(`/admin/requests/${id}/decline`, { note });

export const listAlerts = () => api.get('/admin/alerts', { per_page: FULL_PAGE }).then(unwrap);
export const pageAlerts = ({ page = 1, per_page = 25 } = {}) => api.get('/admin/alerts', { page, per_page });
export const acknowledgeAlert = (id) => api.post(`/admin/alerts/${id}/acknowledge`);
export const resolveAlert = (id, note) => api.post(`/admin/alerts/${id}/resolve`, { resolution_note: note });

// Adds a correction alongside the original clock event; nothing is overwritten.
export const correctClock = (payload) => api.post('/admin/clock_corrections', payload);

/* --------------------------------- Rota ----------------------------------- */

export const listVisits = ({ from, to }) => api.get('/admin/visits', { from, to, per_page: FULL_PAGE }).then(unwrap);
export const pageVisits = ({ from, to, page = 1, per_page = 50 }) => api.get('/admin/visits', { from, to, page, per_page });
export const createVisit = (payload) => api.post('/admin/visits', payload);
export const editVisit = (id, payload) => api.patch(`/admin/visits/${id}`, payload);
export const publishVisit = (id) => api.post(`/admin/visits/${id}/publish`);
export const cancelVisit = (id, reason) => api.post(`/admin/visits/${id}/cancel`, { reason });
export const deleteVisit = (id) => api.delete(`/admin/visits/${id}`);
export const generateVisits = ({ from, to }) => api.post('/admin/visits/generate', { from, to });

// Returns the assignment plus any soft warnings (overlap, rest, weekly hours).
// Warnings never block: the coordinator decides.
export const assignEmployee = ({ visitId, employeeId }) =>
  api.post('/admin/visit_assignments', { visit_id: visitId, employee_id: employeeId });

export const withdrawAssignment = (id) => api.delete(`/admin/visit_assignments/${id}`);

// Atomically move a visit from its current assignment to a different carer.
// assignmentId = the current VisitAssignment id. Returns the new assignment + warnings.
export const reassignAssignment = ({ assignmentId, employeeId }) =>
  api.post(`/admin/visit_assignments/${assignmentId}/reassign`, { employee_id: employeeId });

export const copyRota = (payload) => api.post('/admin/rota_copies', payload);

/* -------------------------------- People ---------------------------------- */

export const listEmployees = () => api.get('/admin/employees', { per_page: FULL_PAGE }).then(unwrap);
export const pageEmployees = ({ page = 1, per_page = 25 } = {}) => api.get('/admin/employees', { page, per_page });

// Avatars (multipart). avatar_url comes back on the serialized identity.
export const uploadMyAvatar = (file) => { const fd = new FormData(); fd.append('avatar', file); return apiUpload('/admin/me/avatar', fd); };
export const removeMyAvatar = () => api.delete('/admin/me/avatar');
export const updateMyProfile = (patch) => api.patch('/admin/me', patch);
export const uploadEmployeeAvatar = (id, file) => { const fd = new FormData(); fd.append('avatar', file); return apiUpload(`/admin/employees/${id}/avatar`, fd); };
export const removeEmployeeAvatar = (id) => api.delete(`/admin/employees/${id}/avatar`);
export const getEmployee = (id) => api.get(`/admin/employees/${id}`);
export const inviteEmployee = (payload) => api.post('/admin/employees', payload);
export const resendEmployeeInvite = (id) => api.post(`/admin/employees/${id}/resend_invite`);
export const updateEmployee = (id, payload) => api.patch(`/admin/employees/${id}`, payload);

export const listServiceUsers = () => api.get('/admin/service_users', { per_page: FULL_PAGE }).then(unwrap);
export const pageServiceUsers = ({ page = 1, per_page = 25 } = {}) => api.get('/admin/service_users', { page, per_page });
export const getServiceUser = (id) => api.get(`/admin/service_users/${id}`);
export const createServiceUser = (payload) => api.post('/admin/service_users', payload);
export const updateServiceUser = (id, payload) => api.patch(`/admin/service_users/${id}`, payload);
export const listCarePlanItems = (serviceUserId) => api.get(`/admin/service_users/${serviceUserId}/care_plan_items`);
export const createCarePlanItem = (serviceUserId, attrs) => api.post(`/admin/service_users/${serviceUserId}/care_plan_items`, attrs);
export const updateCarePlanItem = (serviceUserId, id, attrs) => api.patch(`/admin/service_users/${serviceUserId}/care_plan_items/${id}`, attrs);
export const deleteCarePlanItem = (serviceUserId, id) => api.delete(`/admin/service_users/${serviceUserId}/care_plan_items/${id}`);

// The client's visit-note journal across all visits. filters: { q, employee_id,
// from, to, page, per_page }. Returns { notes, page, per_page, total }.
export const listServiceUserNotes = (serviceUserId, filters = {}) =>
  api.get(`/admin/service_users/${serviceUserId}/notes`, filters);

// This client's visits (who attended, when). filters: from, to, employee_id, page.
export const listServiceUserVisits = (serviceUserId, filters = {}) =>
  api.get(`/admin/service_users/${serviceUserId}/visits`, filters);

// One visit's full record: schedule + care plan + per-assignment tasks/notes/clock.
export const getVisit = (id) => api.get(`/admin/visits/${id}`);

// Paginated { items, page, per_page, total }. Pass { page, per_page, service_user_id }.
export const listCarePackages = (params = {}) => api.get('/admin/care_package_slots', params);

// Weekly availability grid for one carer: [{ weekday, slot, available, ... }].
export const getEmployeeAvailability = (id) => api.get(`/admin/employees/${id}/availability`);

// Carer 360 — everything the office may view about one carer. The profile is a
// summary + recent slices; the sub-resources are paginated ({ items, total, … }).
export const getCarerProfile = (id) => api.get(`/admin/employees/${id}/profile`);
export const listCarerNotes = (id, params = {}) => api.get(`/admin/employees/${id}/notes`, params);
export const listCarerVisits = (id, params = {}) => api.get(`/admin/employees/${id}/visits`, params);
export const listCarerClockEvents = (id, params = {}) => api.get(`/admin/employees/${id}/clock_events`, params);
export const listCarerRequests = (id, params = {}) => api.get(`/admin/employees/${id}/requests`, params);
export const listCarerMileage = (id, params = {}) => api.get(`/admin/employees/${id}/mileage`, params);

/* ----------------------------- Notifications ------------------------------ */

export const listNotifications = (params = {}) => api.get('/notifications', params);
export const markAllNotificationsSeen = () => api.post('/notifications/seen_all');
export const markNotificationSeen = (id) => api.post(`/notifications/${id}/seen`);

/* ------------------------------- Web push --------------------------------- */

// VAPID public key + whether push is configured, so the client can subscribe.
export const getPushConfig = () => api.get('/admin/push/config');
// Register/refresh this browser (with its push subscription) against the admin.
export const registerDevice = (body) => api.post('/admin/devices', body);
// Revoke this browser on sign-out or when push is turned off.
export const deleteDevice = (fingerprint) => api.delete(`/admin/devices/${fingerprint}`);

/* -------------------------------- Messages -------------------------------- */

export const listConversations = () => api.get('/conversations');
export const listMessages = (conversationId) => api.get(`/conversations/${conversationId}/messages`);
export const sendMessage = (conversationId, body, clientMessageId, broadcast = false, visitId = null, files = null) => {
  if (files && files.length) {
    const fd = new FormData();
    fd.append('body', body ?? '');
    fd.append('client_message_id', clientMessageId);
    fd.append('broadcast', broadcast ? 'true' : 'false');
    if (visitId) fd.append('visit_id', visitId);
    files.forEach((f) => fd.append('files[]', f));
    return apiUpload(`/conversations/${conversationId}/messages`, fd);
  }
  return api.post(`/conversations/${conversationId}/messages`, { body, client_message_id: clientMessageId, broadcast, visit_id: visitId });
};
// Mark a message read — stamps a receipt and advances the reader's
// last_read_message_id, which is what clears the conversation's unread count.
export const markMessageRead = (messageId) => api.post(`/messages/${messageId}/receipts`);
export const muteConversation = (id, muted) => api.patch(`/conversations/${id}/mute`, { muted });
export const chaseUnread = (id) => api.post(`/conversations/${id}/chase`);
export const pinMessage = (conversationId, id) => api.post(`/conversations/${conversationId}/messages/${id}/pin`);
export const unpinMessage = (conversationId, id) => api.delete(`/conversations/${conversationId}/messages/${id}/pin`);
export const createChannel = (title, participantIds, purpose, autoPost = false) =>
  api.post('/conversations', { kind: 'channel', title, purpose, auto_post: autoPost, participants: (participantIds ?? []).map((id) => ({ type: 'Employee', id })) });
export const createGroup = (title, participantIds, purpose) =>
  api.post('/conversations', { kind: 'group', title, purpose, participants: (participantIds ?? []).map((id) => ({ type: 'Employee', id })) });
// Open (or reuse — the backend dedupes on the pair) a direct thread with one carer.
export const createDirect = (employeeId) =>
  api.post('/conversations', { kind: 'direct', participant: { type: 'Employee', id: employeeId } });
// Add carers to an existing group/channel. Direct threads reject this server-side.
export const addConversationParticipants = (conversationId, participantIds) =>
  api.post(`/conversations/${conversationId}/participants`, { participants: (participantIds ?? []).map((id) => ({ type: 'Employee', id })) });
// Full-text search over message bodies in my conversations -> { query, results: [{ conversation_id, snippet, ... }] }
export const searchConversations = (q) => api.get(`/conversations/search?q=${encodeURIComponent(q ?? '')}`);

// Streams the report pack file (CSV or XLSX) and triggers a download.
export async function exportReportPack(from, to, type = 'csv') {
  const qs = new URLSearchParams({ from, to, type }).toString();
  const res = await fetch(`${env.apiBaseUrl}/admin/report_exports?${qs}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Could not generate the report pack');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `report-pack.${type === 'xlsx' ? 'xlsx' : 'csv'}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Streams the audit log file (CSV or XLSX) and triggers a download.
export async function exportAuditLog(params = {}, type = 'csv') {
  const qs = new URLSearchParams({ ...params, type }).toString();
  const res = await fetch(`${env.apiBaseUrl}/admin/audit_exports?${qs}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Could not generate the audit export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `audit-log.${type === 'xlsx' ? 'xlsx' : 'csv'}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// The same CQC visit-attendance rows as JSON, for the on-screen filterable
// table (one row per carer x visit) — optionally narrowed to one client and/or
// one carer.
export const listAttendanceAudit = ({ from, to, serviceUserId, employeeId } = {}) =>
  api.get('/admin/attendance_audit_exports/rows', {
    from, to, service_user_id: serviceUserId || undefined, employee_id: employeeId || undefined,
  });

// Streams the CQC visit-attendance audit (one row per carer x visit over the
// date range) as CSV or XLSX and triggers a download.
export async function exportAttendanceAudit(from, to, type = 'csv', { serviceUserId, employeeId } = {}) {
  const params = { from, to, type };
  if (serviceUserId) params.service_user_id = serviceUserId;
  if (employeeId) params.employee_id = employeeId;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${env.apiBaseUrl}/admin/attendance_audit_exports?${qs}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Could not generate the visit audit');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `visit-audit.${type === 'xlsx' ? 'xlsx' : 'csv'}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Streams the rota file (CSV or XLSX) and triggers a download.
export async function exportRota(from, to, type = 'csv') {
  const qs = new URLSearchParams({ from, to, type }).toString();
  const res = await fetch(`${env.apiBaseUrl}/admin/rota_exports?${qs}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Could not generate the rota export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `rota.${type === 'xlsx' ? 'xlsx' : 'csv'}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------- Settings --------------------------------- */

export const getSettings = () => api.get('/admin/settings');
export const updateSettings = (payload) => api.patch('/admin/settings', payload);
