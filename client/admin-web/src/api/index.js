import api from './client.js';
import env from '../config/env.js';
import { getToken } from '../utils/storage.js';
import * as mock from '../mocks/mockApi.js';

// One module for the office endpoints. Each function is a single call, so
// switching any of them to the live API is a one line change.

const pick = (mockFn, liveFn) => (...args) => (env.useMock ? mockFn(...args) : liveFn(...args));

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

export const login = pick(mock.login, ({ email, password }) =>
  api.post('/admin/auth/login', { email, password }, { auth: false })
);

export const completeMfa = pick(mock.completeMfa, ({ mfaToken, otpCode }) =>
  api.post('/auth/mfa', { mfa_token: mfaToken, otp_code: otpCode }, { auth: false })
);

export const fetchCurrentAdmin = pick(mock.fetchCurrentAdmin, () => api.get('/admin/me'));
export const logout = pick(mock.logout, () => api.delete('/auth/logout'));

export const beginMfaEnrolment = pick(mock.beginMfaEnrolment, () => api.post('/admin/mfa'));
export const confirmMfaEnrolment = pick(mock.confirmMfaEnrolment, (otpCode) =>
  api.post('/admin/mfa/confirm', { otp_code: otpCode })
);

export const requestPasswordReset = pick(mock.requestPasswordReset, (email) =>
  api.post('/admin/auth/password', { email }, { auth: false })
);

// Set a password from an invite or reset token — the same PUT serves both.
export const setPassword = pick(mock.setPassword, ({ token, password }) =>
  api.put('/admin/auth/password', { token, password }, { auth: false })
);

/* ---------------------------- Team (office admins) ------------------------ */

export const listAdmins = pick(mock.listAdmins, () => api.get('/admin/admins'));
export const inviteAdmin = pick(mock.inviteAdmin, (attrs) => api.post('/admin/admins', attrs));
export const updateAdmin = pick(mock.updateAdmin, (id, payload) => api.patch(`/admin/admins/${id}`, payload));

/* ------------------------------ Monitoring -------------------------------- */

export const getDashboard = pick(mock.getDashboard, () => api.get('/admin/dashboard'));
export const getLiveBoard = pick(mock.getLiveBoard, () => api.get('/admin/live_board'));
export const getExceptions = pick(mock.getExceptions, () => api.get('/admin/exceptions'));

// Append-only Event audit log (read-only): who did what, when and why.
export const listAudit = pick(
  mock.listAudit ?? (() => Promise.resolve([])),
  (params = {}) => api.get('/admin/audit', params)
);

// Clocking-performance aggregates over a date range.
export const getReports = pick(
  mock.getReports ?? (() => Promise.resolve(null)),
  (params = {}) => api.get('/admin/reports', params)
);

// Cover: unfilled visits + offers.
export const getCover = pick(mock.getCover ?? (() => Promise.resolve({ open_shifts: [], counts: {} })), () => api.get('/admin/cover'));
export const createCoverOffer = pick(mock.createCoverOffer ?? (() => Promise.resolve({})), (visitId, employeeId, note) =>
  api.post('/admin/cover_offers', { visit_id: visitId, employee_id: employeeId, note })
);
export const acceptCoverOffer = pick(mock.acceptCoverOffer ?? ((id) => Promise.resolve({ id })), (id) => api.post(`/admin/cover_offers/${id}/accept`));
export const declineCoverOffer = pick(mock.declineCoverOffer ?? ((id) => Promise.resolve({ id })), (id) => api.post(`/admin/cover_offers/${id}/decline`));

// Carer requests queue.
export const listRequests = pick(mock.listRequests ?? (() => Promise.resolve([])), (params = {}) => api.get('/admin/requests', params));
export const approveRequest = pick(mock.approveRequest ?? ((id) => Promise.resolve({ id })), (id, note) => api.post(`/admin/requests/${id}/approve`, { note }));
export const declineRequest = pick(mock.declineRequest ?? ((id) => Promise.resolve({ id })), (id, note) => api.post(`/admin/requests/${id}/decline`, { note }));

export const listAlerts = pick(mock.listAlerts, () => api.get('/admin/alerts'));
export const acknowledgeAlert = pick(mock.acknowledgeAlert, (id) =>
  api.post(`/admin/alerts/${id}/acknowledge`)
);
export const resolveAlert = pick(mock.resolveAlert, (id, note) =>
  api.post(`/admin/alerts/${id}/resolve`, { resolution_note: note })
);

// Adds a correction alongside the original clock event; nothing is overwritten.
export const correctClock = pick(mock.correctClock, (payload) =>
  api.post('/admin/clock_corrections', payload)
);

/* --------------------------------- Rota ----------------------------------- */

export const listVisits = pick(mock.listVisits, ({ from, to }) =>
  api.get('/admin/visits', { from, to })
);
export const createVisit = pick(mock.createVisit, (payload) => api.post('/admin/visits', payload));
export const editVisit = pick(mock.editVisit, (id, payload) => api.patch(`/admin/visits/${id}`, payload));
export const publishVisit = pick(mock.publishVisit, (id) => api.post(`/admin/visits/${id}/publish`));
export const generateVisits = pick(mock.generateVisits, ({ from, to }) =>
  api.post('/admin/visits/generate', { from, to })
);

// Returns the assignment plus any soft warnings (overlap, rest, weekly hours).
// Warnings never block: the coordinator decides.
export const assignEmployee = pick(mock.assignEmployee, ({ visitId, employeeId }) =>
  api.post('/admin/visit_assignments', { visit_id: visitId, employee_id: employeeId })
);

export const withdrawAssignment = pick(mock.withdrawAssignment, (id) =>
  api.delete(`/admin/visit_assignments/${id}`)
);

export const copyRota = pick(mock.copyRota, (payload) => api.post('/admin/rota_copies', payload));

/* -------------------------------- People ---------------------------------- */

export const listEmployees = pick(mock.listEmployees, () => api.get('/admin/employees'));

// Avatars (multipart). avatar_url comes back on the serialized identity.
export const uploadMyAvatar = (file) => { const fd = new FormData(); fd.append('avatar', file); return apiUpload('/admin/me/avatar', fd); };
export const removeMyAvatar = () => api.delete('/admin/me/avatar');
export const uploadEmployeeAvatar = (id, file) => { const fd = new FormData(); fd.append('avatar', file); return apiUpload(`/admin/employees/${id}/avatar`, fd); };
export const removeEmployeeAvatar = (id) => api.delete(`/admin/employees/${id}/avatar`);
export const getEmployee = pick(mock.getEmployee, (id) => api.get(`/admin/employees/${id}`));
export const inviteEmployee = pick(mock.inviteEmployee, (payload) =>
  api.post('/admin/employees', payload)
);
export const updateEmployee = pick(mock.updateEmployee, (id, payload) =>
  api.patch(`/admin/employees/${id}`, payload)
);

export const listServiceUsers = pick(mock.listServiceUsers, () => api.get('/admin/service_users'));
export const getServiceUser = pick(mock.getServiceUser ?? ((id) => api.get(`/admin/service_users/${id}`)), (id) =>
  api.get(`/admin/service_users/${id}`)
);
export const createServiceUser = pick(mock.createServiceUser, (payload) =>
  api.post('/admin/service_users', payload)
);
export const updateServiceUser = pick(mock.updateServiceUser, (id, payload) =>
  api.patch(`/admin/service_users/${id}`, payload)
);
export const listCarePlanItems = pick(
  mock.listCarePlanItems ?? (() => Promise.resolve([])),
  (serviceUserId) => api.get(`/admin/service_users/${serviceUserId}/care_plan_items`)
);

export const listCarePackages = pick(mock.listCarePackages, () =>
  api.get('/admin/care_package_slots')
);

// Weekly availability grid for one carer: [{ weekday, slot, available, ... }].
export const getEmployeeAvailability = pick(
  mock.getEmployeeAvailability ?? (() => Promise.resolve([])),
  (id) => api.get(`/admin/employees/${id}/availability`)
);

/* ----------------------------- Notifications ------------------------------ */

export const listNotifications = pick(
  mock.listNotifications ?? (() => Promise.resolve([])),
  (params = {}) => api.get('/notifications', params)
);
export const markAllNotificationsSeen = pick(
  mock.markAllNotificationsSeen ?? (() => Promise.resolve({ updated: 0 })),
  () => api.post('/notifications/seen_all')
);
export const markNotificationSeen = pick(
  mock.markNotificationSeen ?? ((id) => Promise.resolve({ id })),
  (id) => api.post(`/notifications/${id}/seen`)
);

/* -------------------------------- Messages -------------------------------- */

export const listConversations = pick(
  mock.listConversations ?? (() => Promise.resolve([])),
  () => api.get('/conversations')
);
export const listMessages = pick(
  mock.listMessages ?? (() => Promise.resolve([])),
  (conversationId) => api.get(`/conversations/${conversationId}/messages`)
);
export const sendMessage = pick(
  mock.sendMessage ?? (() => Promise.reject(new Error('Messaging is not available in mock mode'))),
  (conversationId, body, clientMessageId, broadcast = false, visitId = null, files = null) => {
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
  }
);
export const muteConversation = pick(mock.muteConversation ?? ((id) => Promise.resolve({ id })), (id, muted) => api.patch(`/conversations/${id}/mute`, { muted }));
export const chaseUnread = pick(mock.chaseUnread ?? (() => Promise.resolve({ chased: 0 })), (id) => api.post(`/conversations/${id}/chase`));
export const pinMessage = pick(mock.pinMessage ?? (() => Promise.resolve({})), (conversationId, id) => api.post(`/conversations/${conversationId}/messages/${id}/pin`));
export const unpinMessage = pick(mock.unpinMessage ?? (() => Promise.resolve({})), (conversationId, id) => api.delete(`/conversations/${conversationId}/messages/${id}/pin`));
export const createChannel = pick(
  mock.createChannel ?? (() => Promise.resolve({})),
  (title, participantIds, purpose, autoPost = false) => api.post('/conversations', { kind: 'channel', title, purpose, auto_post: autoPost, participants: (participantIds ?? []).map((id) => ({ type: 'Employee', id })) })
);
export const createGroup = pick(
  mock.createGroup ?? (() => Promise.resolve({})),
  (title, participantIds, purpose) => api.post('/conversations', { kind: 'group', title, purpose, participants: (participantIds ?? []).map((id) => ({ type: 'Employee', id })) })
);

/* ------------------------------ Timesheets -------------------------------- */

export const listTimesheetPeriods = pick(mock.listTimesheetPeriods, () =>
  api.get('/admin/timesheet_periods')
);
export const getTimesheetPeriod = pick(mock.getTimesheetPeriod, (id) =>
  api.get(`/admin/timesheet_periods/${id}`)
);
export const approvePeriod = pick(mock.approvePeriod, (id) =>
  api.post(`/admin/timesheet_periods/${id}/approve`)
);
export const lockPeriod = pick(mock.lockPeriod, (id) =>
  api.post(`/admin/timesheet_periods/${id}/lock`)
);
export const listDisputes = pick(mock.listDisputes, () => api.get('/admin/timesheet_disputes'));
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

export const resolveDispute = pick(mock.resolveDispute, (id, note) =>
  api.post(`/admin/timesheet_disputes/${id}/resolve`, { resolution_note: note })
);

/* ------------------------------- Settings --------------------------------- */

export const getSettings = pick(mock.getSettings, () => api.get('/admin/settings'));
export const updateSettings = pick(mock.updateSettings, (payload) =>
  api.patch('/admin/settings', payload)
);
