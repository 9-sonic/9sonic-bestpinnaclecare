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

export const listAdmins = () => api.get('/admin/admins');
export const inviteAdmin = (attrs) => api.post('/admin/admins', attrs);
export const updateAdmin = (id, payload) => api.patch(`/admin/admins/${id}`, payload);

/* ------------------------------ Monitoring -------------------------------- */

export const getDashboard = () => api.get('/admin/dashboard');
export const getLiveBoard = () => api.get('/admin/live_board');
export const getExceptions = () => api.get('/admin/exceptions');

// Append-only Event audit log (read-only): who did what, when and why.
export const listAudit = (params = {}) => api.get('/admin/audit', params);

// Clocking-performance aggregates over a date range.
export const getReports = (params = {}) => api.get('/admin/reports', params);

// Cover: unfilled visits + offers.
export const getCover = () => api.get('/admin/cover');
export const createCoverOffer = (visitId, employeeId, note) =>
  api.post('/admin/cover_offers', { visit_id: visitId, employee_id: employeeId, note });
export const acceptCoverOffer = (id) => api.post(`/admin/cover_offers/${id}/accept`);
export const declineCoverOffer = (id) => api.post(`/admin/cover_offers/${id}/decline`);

// Carer requests queue.
export const listRequests = (params = {}) => api.get('/admin/requests', params);
export const approveRequest = (id, note) => api.post(`/admin/requests/${id}/approve`, { note });
export const declineRequest = (id, note) => api.post(`/admin/requests/${id}/decline`, { note });

export const listAlerts = () => api.get('/admin/alerts');
export const acknowledgeAlert = (id) => api.post(`/admin/alerts/${id}/acknowledge`);
export const resolveAlert = (id, note) => api.post(`/admin/alerts/${id}/resolve`, { resolution_note: note });

// Adds a correction alongside the original clock event; nothing is overwritten.
export const correctClock = (payload) => api.post('/admin/clock_corrections', payload);

/* --------------------------------- Rota ----------------------------------- */

export const listVisits = ({ from, to }) => api.get('/admin/visits', { from, to });
export const createVisit = (payload) => api.post('/admin/visits', payload);
export const editVisit = (id, payload) => api.patch(`/admin/visits/${id}`, payload);
export const publishVisit = (id) => api.post(`/admin/visits/${id}/publish`);
export const cancelVisit = (id, reason) => api.post(`/admin/visits/${id}/cancel`, { reason });
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

export const listEmployees = () => api.get('/admin/employees');

// Avatars (multipart). avatar_url comes back on the serialized identity.
export const uploadMyAvatar = (file) => { const fd = new FormData(); fd.append('avatar', file); return apiUpload('/admin/me/avatar', fd); };
export const removeMyAvatar = () => api.delete('/admin/me/avatar');
export const updateMyProfile = (patch) => api.patch('/admin/me', patch);
export const uploadEmployeeAvatar = (id, file) => { const fd = new FormData(); fd.append('avatar', file); return apiUpload(`/admin/employees/${id}/avatar`, fd); };
export const removeEmployeeAvatar = (id) => api.delete(`/admin/employees/${id}/avatar`);
export const getEmployee = (id) => api.get(`/admin/employees/${id}`);
export const inviteEmployee = (payload) => api.post('/admin/employees', payload);
export const updateEmployee = (id, payload) => api.patch(`/admin/employees/${id}`, payload);

export const listServiceUsers = () => api.get('/admin/service_users');
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

// One visit's delivery record: schedule + care plan + per-assignment tasks/notes.
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
export const listCarerTimesheetLines = (id, params = {}) => api.get(`/admin/employees/${id}/timesheet_lines`, params);
export const listCarerRequests = (id, params = {}) => api.get(`/admin/employees/${id}/requests`, params);

/* ----------------------------- Notifications ------------------------------ */

export const listNotifications = (params = {}) => api.get('/notifications', params);
export const markAllNotificationsSeen = () => api.post('/notifications/seen_all');
export const markNotificationSeen = (id) => api.post(`/notifications/${id}/seen`);

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

/* ------------------------------ Timesheets -------------------------------- */

export const listTimesheetPeriods = () => api.get('/admin/timesheet_periods');
export const getTimesheetPeriod = (id) => api.get(`/admin/timesheet_periods/${id}`);
export const approvePeriod = (id) => api.post(`/admin/timesheet_periods/${id}/approve`);
export const approveCarerLines = (periodId, employeeId) =>
  api.post(`/admin/timesheet_periods/${periodId}/approve_carer`, { employee_id: employeeId });
export const lockPeriod = (id) => api.post(`/admin/timesheet_periods/${id}/lock`);
export const listDisputes = () => api.get('/admin/timesheet_disputes');

// Streams the payroll export file (CSV or XLSX) and triggers a download.
export async function exportTimesheetPeriod(id, type = 'csv') {
  const res = await fetch(`${env.apiBaseUrl}/admin/timesheet_exports/${id}?type=${type}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Could not generate the export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `timesheet-${id}.${type === 'xlsx' ? 'xlsx' : 'csv'}`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

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

export const resolveDispute = (id, note) =>
  api.post(`/admin/timesheet_disputes/${id}/resolve`, { resolution_note: note });

/* ------------------------------- Settings --------------------------------- */

export const getSettings = () => api.get('/admin/settings');
export const updateSettings = (payload) => api.patch('/admin/settings', payload);
