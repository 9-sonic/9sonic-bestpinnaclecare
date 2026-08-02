import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';

// One module for the office endpoints. Each function is a single call, so
// switching any of them to the live API is a one line change.

const pick = (mockFn, liveFn) => (...args) => (env.useMock ? mockFn(...args) : liveFn(...args));

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

/* ------------------------------ Monitoring -------------------------------- */

export const getDashboard = pick(mock.getDashboard, () => api.get('/admin/dashboard'));
export const getLiveBoard = pick(mock.getLiveBoard, () => api.get('/admin/live_board'));
export const getExceptions = pick(mock.getExceptions, () => api.get('/admin/exceptions'));

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
export const getEmployee = pick(mock.getEmployee, (id) => api.get(`/admin/employees/${id}`));
export const inviteEmployee = pick(mock.inviteEmployee, (payload) =>
  api.post('/admin/employees', payload)
);
export const updateEmployee = pick(mock.updateEmployee, (id, payload) =>
  api.patch(`/admin/employees/${id}`, payload)
);

export const listServiceUsers = pick(mock.listServiceUsers, () => api.get('/admin/service_users'));
export const createServiceUser = pick(mock.createServiceUser, (payload) =>
  api.post('/admin/service_users', payload)
);
export const updateServiceUser = pick(mock.updateServiceUser, (id, payload) =>
  api.patch(`/admin/service_users/${id}`, payload)
);

export const listCarePackages = pick(mock.listCarePackages, () =>
  api.get('/admin/care_package_slots')
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
export const resolveDispute = pick(mock.resolveDispute, (id, note) =>
  api.post(`/admin/timesheet_disputes/${id}/resolve`, { resolution_note: note })
);

/* ------------------------------- Settings --------------------------------- */

export const getSettings = pick(mock.getSettings, () => api.get('/admin/settings'));
export const updateSettings = pick(mock.updateSettings, (payload) =>
  api.patch('/admin/settings', payload)
);
