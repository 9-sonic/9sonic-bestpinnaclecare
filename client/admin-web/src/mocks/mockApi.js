// Demo data for the office app, shaped exactly like the Rails serializers.
//
// Held in memory rather than localStorage: a manager reloading the page should
// get a clean, predictable board rather than whatever state a previous session
// left behind.

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const TOKEN = 'mock.admin.jwt';

function at(h, m = 0, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const isoDay = (o = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

const admin = {
  id: 1,
  email: 'reg.manager@bestpinnacle.test',
  first_name: 'Ruth',
  last_name: 'Adeyemi',
  full_name: 'Ruth Adeyemi',
  role: 'registered_manager',
  active: true,
  mfa_enabled: true,
};

let serviceUsers = [
  { id: 1, first_name: 'Edith', last_name: 'Thornbury', full_name: 'Edith Thornbury', reference: 'SU-1042', phone: '0113 296 0001', address_line1: '12 Rosewood Avenue', address_line2: null, city: 'Leeds', postcode: 'LS8 3AB', lat: 53.8225, lng: -1.5203, geofence_radius_m: 150, geofence_mode: 'block', access_notes: 'Key safe by the back door. Dog is friendly.', active: true },
  { id: 2, first_name: 'Harold', last_name: 'Greaves', full_name: 'Harold Greaves', reference: 'SU-1088', phone: '0113 296 0002', address_line1: '8 Canal Street', address_line2: 'Flat 2', city: 'Leeds', postcode: 'LS1 4RT', lat: 53.7955, lng: -1.5491, geofence_radius_m: 150, geofence_mode: 'warn', access_notes: 'Buzzer 2. Slow to the door, allow time.', active: true },
  { id: 3, first_name: 'Maud', last_name: 'Fenwick', full_name: 'Maud Fenwick', reference: 'SU-1120', phone: '0113 296 0003', address_line1: '4 Kiln Lane', address_line2: null, city: 'Leeds', postcode: 'LS6 2QP', lat: 53.8102, lng: -1.5615, geofence_radius_m: 200, geofence_mode: 'block', access_notes: 'Family usually in during mornings.', active: true },
  { id: 4, first_name: 'Priya', last_name: 'Sharma', full_name: 'Priya Sharma', reference: 'SU-1155', phone: '0113 296 0004', address_line1: '88 Beech Avenue', address_line2: null, city: 'Leeds', postcode: 'LS6 2QP', lat: 53.8188, lng: -1.5722, geofence_radius_m: 150, geofence_mode: 'block', access_notes: null, active: true },
  { id: 5, first_name: 'Bill', last_name: 'Okafor', full_name: 'Bill Okafor', reference: 'SU-1190', phone: '0113 296 0005', address_line1: '17 Mill Road', address_line2: null, city: 'Leeds', postcode: 'LS7 1XX', lat: 53.8310, lng: -1.5400, geofence_radius_m: 150, geofence_mode: 'block', access_notes: 'Hard of hearing, ring twice.', active: true },
];

let employees = [
  { id: 1, email: 'cara.erikson@pinnaclecare.co.uk', first_name: 'Cara', last_name: 'Erikson', full_name: 'Cara Erikson', role: 'carer', employee_reference: 'EMP-2274', active: true, mfa_enabled: false, phone: '07700 900112' },
  { id: 2, email: 'tom.whitfield@pinnaclecare.co.uk', first_name: 'Tom', last_name: 'Whitfield', full_name: 'Tom Whitfield', role: 'senior_carer', employee_reference: 'EMP-2280', active: true, mfa_enabled: false, phone: '07700 900113' },
  { id: 3, email: 'aisha.bello@pinnaclecare.co.uk', first_name: 'Aisha', last_name: 'Bello', full_name: 'Aisha Bello', role: 'carer', employee_reference: 'EMP-2291', active: true, mfa_enabled: false, phone: '07700 900114' },
  { id: 4, email: 'jan.kowalski@pinnaclecare.co.uk', first_name: 'Jan', last_name: 'Kowalski', full_name: 'Jan Kowalski', role: 'carer', employee_reference: 'EMP-2305', active: true, mfa_enabled: false, phone: '07700 900115' },
  { id: 5, email: 'mary.donnelly@pinnaclecare.co.uk', first_name: 'Mary', last_name: 'Donnelly', full_name: 'Mary Donnelly', role: 'carer', employee_reference: 'EMP-2311', active: false, mfa_enabled: false, phone: '07700 900116' },
];

const visitFor = (id, suId, start, end, status = 'published') => ({
  id,
  service_user_id: suId,
  scheduled_start: start,
  scheduled_end: end,
  status,
  staff_required: 1,
  published_at: status === 'published' ? at(8, 0, -3) : null,
  service_user: serviceUsers.find((s) => s.id === suId),
});

let visits = [
  visitFor(501, 3, at(7, 0), at(8, 0)),
  visitFor(502, 1, at(9, 30), at(11, 0)),
  visitFor(503, 2, at(13, 30), at(14, 30)),
  visitFor(504, 4, at(16, 0), at(17, 30)),
  visitFor(505, 5, at(18, 0), at(19, 0)),
  visitFor(506, 1, at(9, 30, 1), at(11, 0, 1)),
  visitFor(507, 2, at(13, 30, 1), at(14, 30, 1)),
  visitFor(508, 3, at(7, 0, 1), at(8, 0, 1), 'draft'),
  visitFor(509, 5, at(18, 0, 1), at(19, 0, 1), 'draft'),
];

let assignments = [
  { id: 101, visit_id: 501, employee_id: 1, lifecycle_state: 'completed', assignment_status: 'assigned', actual_start: at(7, 1), actual_end: at(8, 4), worked_minutes: 63, flags: [] },
  { id: 102, visit_id: 502, employee_id: 1, lifecycle_state: 'in_progress', assignment_status: 'assigned', actual_start: at(9, 34), actual_end: null, worked_minutes: null, flags: ['late_start'] },
  { id: 103, visit_id: 503, employee_id: 2, lifecycle_state: 'scheduled', assignment_status: 'assigned', actual_start: null, actual_end: null, worked_minutes: null, flags: [] },
  { id: 104, visit_id: 504, employee_id: 3, lifecycle_state: 'late', assignment_status: 'assigned', actual_start: null, actual_end: null, worked_minutes: null, flags: [] },
  { id: 105, visit_id: 505, employee_id: 4, lifecycle_state: 'pending_review', assignment_status: 'assigned', actual_start: at(18, 2), actual_end: null, worked_minutes: null, flags: ['no_clock_out'] },
  { id: 106, visit_id: 506, employee_id: 2, lifecycle_state: 'scheduled', assignment_status: 'assigned', actual_start: null, actual_end: null, worked_minutes: null, flags: [] },
];

let alerts = [
  { id: 9001, alert_type: 'visit_late', severity: 'high', state: 'open', subject_type: 'VisitAssignment', subject_id: 104, raised_at: at(16, 10), acknowledged_at: null, resolved_at: null },
  { id: 9002, alert_type: 'no_clock_out', severity: 'normal', state: 'open', subject_type: 'VisitAssignment', subject_id: 105, raised_at: at(19, 30), acknowledged_at: null, resolved_at: null },
  { id: 9003, alert_type: 'unassigned_visit', severity: 'normal', state: 'open', subject_type: 'Visit', subject_id: 507, raised_at: at(8, 0), acknowledged_at: null, resolved_at: null },
];

let periods = [
  { id: 70, starts_on: isoDay(-6), ends_on: isoDay(0), status: 'open', approved_at: null, locked_at: null },
  { id: 69, starts_on: isoDay(-13), ends_on: isoDay(-7), status: 'approved', approved_at: at(10, 0, -6), locked_at: null },
  { id: 68, starts_on: isoDay(-20), ends_on: isoDay(-14), status: 'locked', approved_at: at(10, 0, -13), locked_at: at(11, 0, -13) },
];

let disputes = [
  { id: 401, timesheet_line_id: 9003, raised_by_employee_id: 1, reason: 'I stayed until 15:00 but this shows 14:30.', state: 'open', resolution_note: null, created_at: at(17, 12, -1) },
];

const carePackages = [
  { id: 61, service_user_id: 1, name: 'Morning call', start_time: '09:30', end_time: '11:00', recurrence: 'weekdays', staff_required: 1, break_minutes: 0, effective_from: isoDay(-90), effective_to: null, active: true },
  { id: 62, service_user_id: 2, name: 'Lunch call', start_time: '13:30', end_time: '14:30', recurrence: 'daily', staff_required: 1, break_minutes: 0, effective_from: isoDay(-60), effective_to: null, active: true },
  { id: 63, service_user_id: 3, name: 'Wake up call', start_time: '07:00', end_time: '08:00', recurrence: 'daily', staff_required: 1, break_minutes: 0, effective_from: isoDay(-120), effective_to: null, active: true },
];

let settings = {
  id: 1,
  company_name: 'Best Pinnacle Care',
  trading_name: 'Best Pinnacle Care',
  timezone: 'Europe/London',
  currency_code: 'GBP',
  checkin_window_before_start_minutes: 15,
  late_grace_minutes: 5,
  missed_threshold_minutes: 30,
  overdue_threshold_minutes: 60,
  auto_close_after_minutes: 240,
  early_leave_tolerance_minutes: 10,
  clock_skew_tolerance_minutes: 10,
  geofence_mode: 'block',
  geofence_radius_m: 150,
  timesheet_period: 'weekly',
  timesheet_week_starts_on: 1,
  timesheet_rounding_minutes: 0,
};

const withVisit = (a) => ({ ...a, visit: visits.find((v) => v.id === a.visit_id) });
const todayOnly = (a) => new Date(withVisit(a).visit.scheduled_start).toDateString() === new Date().toDateString();

/* --------------------------------- Auth ---------------------------------- */

export async function login({ email }) {
  await delay(380);
  // Mirrors the real flow: an MFA-enabled admin gets a challenge, not a token.
  if (email && email.startsWith('nomfa')) return { access: TOKEN, admin: { ...admin, mfa_enabled: false } };
  return { mfa_required: true, mfa_token: 'mock-challenge-token' };
}

export async function completeMfa() {
  await delay(320);
  return { access: TOKEN, admin };
}

export async function fetchCurrentAdmin() {
  await delay(120);
  return admin;
}

export async function logout() {
  await delay(80);
  return null;
}

export async function beginMfaEnrolment() {
  await delay(300);
  return { otpauth_uri: 'otpauth://totp/Best%20Pinnacle%20Care:demo', qr_svg: '' };
}

export async function confirmMfaEnrolment() {
  await delay(300);
  return { mfa_enabled: true, backup_codes: ['A1B2-C3D4', 'E5F6-G7H8', 'J9K0-L1M2'] };
}

export async function requestPasswordReset() {
  await delay(400);
  return null;
}

export async function setPassword() {
  await delay(400);
  return null;
}

export async function listAdmins() {
  await delay(300);
  return [
    { id: 1, email: 'reg.manager@bestpinnacle.test', first_name: 'Reg', last_name: 'Manager', full_name: 'Reg Manager', avatar_url: null, role: 'registered_manager', active: true, mfa_enabled: true, invited_at: '2026-01-04T09:00:00Z', accepted_invite_at: '2026-01-04T09:20:00Z' },
    { id: 2, email: 'coordinator@bestpinnacle.test', first_name: 'Casey', last_name: 'Ops', full_name: 'Casey Ops', avatar_url: null, role: 'coordinator', active: true, mfa_enabled: true, invited_at: '2026-02-10T09:00:00Z', accepted_invite_at: '2026-02-10T10:00:00Z' },
    { id: 3, email: 'finance@bestpinnacle.test', first_name: 'Fran', last_name: 'Ledger', full_name: 'Fran Ledger', avatar_url: null, role: 'finance', active: true, mfa_enabled: false, invited_at: '2026-08-01T09:00:00Z', accepted_invite_at: null },
  ];
}

export async function inviteAdmin(attrs) {
  await delay(300);
  return { id: Date.now(), full_name: `${attrs.first_name} ${attrs.last_name}`, avatar_url: null, active: true, mfa_enabled: false, invited_at: new Date().toISOString(), accepted_invite_at: null, ...attrs };
}

export async function updateAdmin(id, payload) {
  await delay(300);
  return { id, ...payload };
}

/* ------------------------------ Monitoring -------------------------------- */

export async function getDashboard() {
  await delay(240);
  const today = assignments.filter(todayOnly);
  const counts = today.reduce((acc, a) => {
    acc[a.lifecycle_state] = (acc[a.lifecycle_state] ?? 0) + 1;
    return acc;
  }, {});
  const assignedVisitIds = new Set(assignments.map((a) => a.visit_id));
  return {
    date: isoDay(0),
    today_counts: counts,
    open_alerts: alerts.filter((a) => a.state === 'open').length,
    pending_review: today.filter((a) => a.lifecycle_state === 'pending_review').length,
    unassigned_upcoming: visits.filter(
      (v) => v.status === 'published' && !assignedVisitIds.has(v.id)
    ).length,
  };
}

export async function getLiveBoard() {
  await delay(260);
  const today = assignments.filter(todayOnly).map(withVisit);
  const counts = today.reduce((acc, a) => {
    acc[a.lifecycle_state] = (acc[a.lifecycle_state] ?? 0) + 1;
    return acc;
  }, {});
  return { date: isoDay(0), counts, assignments: today };
}

export async function getExceptions() {
  await delay(240);
  return {
    pending_review: assignments
      .filter((a) => ['pending_review', 'missed', 'overdue'].includes(a.lifecycle_state))
      .map(withVisit),
    open_alerts: alerts.filter((a) => a.state === 'open'),
  };
}

export async function listAlerts() {
  await delay(200);
  return alerts;
}

export async function acknowledgeAlert(id) {
  await delay(180);
  alerts = alerts.map((a) =>
    String(a.id) === String(id) ? { ...a, state: 'acknowledged', acknowledged_at: new Date().toISOString() } : a
  );
  return alerts.find((a) => String(a.id) === String(id));
}

export async function resolveAlert(id, note) {
  await delay(180);
  alerts = alerts.map((a) =>
    String(a.id) === String(id)
      ? { ...a, state: 'resolved', resolved_at: new Date().toISOString(), resolution_note: note }
      : a
  );
  return alerts.find((a) => String(a.id) === String(id));
}

export async function correctClock(payload) {
  await delay(320);
  const va = assignments.find((a) => String(a.id) === String(payload.visit_assignment_id));
  if (va) {
    if (payload.kind === 'clock_out') {
      va.actual_end = payload.occurred_at;
      va.lifecycle_state = 'completed';
      va.worked_minutes = Math.max(
        1,
        Math.round((new Date(va.actual_end) - new Date(va.actual_start)) / 60000)
      );
    } else {
      va.actual_start = payload.occurred_at;
    }
    va.flags = [...new Set([...(va.flags ?? []), 'corrected'])];
  }
  return { ok: true };
}

/* --------------------------------- Rota ----------------------------------- */

export async function listVisits({ from, to } = {}) {
  await delay(280);
  let list = visits;
  if (from) list = list.filter((v) => new Date(v.scheduled_start) >= new Date(`${from}T00:00:00`));
  if (to) list = list.filter((v) => new Date(v.scheduled_start) <= new Date(`${to}T23:59:59`));
  return list
    .slice()
    .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
    .map((v) => ({
      ...v,
      assignments: assignments
        .filter((a) => a.visit_id === v.id && a.assignment_status === 'assigned')
        .map((a) => ({ ...a, employee: employees.find((e) => e.id === a.employee_id) })),
    }));
}

export async function createVisit(payload) {
  await delay(300);
  const v = visitFor(
    Math.max(...visits.map((x) => x.id)) + 1,
    Number(payload.service_user_id),
    payload.scheduled_start,
    payload.scheduled_end,
    'draft'
  );
  visits = [...visits, v];
  return v;
}

export async function publishVisit(id) {
  await delay(240);
  visits = visits.map((v) =>
    String(v.id) === String(id)
      ? { ...v, status: 'published', published_at: new Date().toISOString() }
      : v
  );
  return visits.find((v) => String(v.id) === String(id));
}

export async function generateVisits({ from, to }) {
  await delay(600);
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  return { created: days * carePackages.length };
}

// Soft validators, matching the server: warnings inform, they never block.
export async function assignEmployee({ visitId, employeeId }) {
  await delay(340);
  const visit = visits.find((v) => String(v.id) === String(visitId));
  const employee = employees.find((e) => String(e.id) === String(employeeId));
  const warnings = [];

  const start = new Date(visit.scheduled_start);
  const end = new Date(visit.scheduled_end);

  const clash = assignments
    .filter((a) => a.employee_id === employee.id && a.assignment_status === 'assigned')
    .map(withVisit)
    .find((a) => {
      const s = new Date(a.visit.scheduled_start);
      const e = new Date(a.visit.scheduled_end);
      return s < end && e > start;
    });

  if (clash) {
    warnings.push(
      `Overlaps ${clash.visit.service_user.full_name} at ${new Date(
        clash.visit.scheduled_start
      ).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    );
  }
  if (!employee.active) warnings.push('This carer is marked inactive');

  const sameDayMinutes = assignments
    .filter((a) => a.employee_id === employee.id)
    .map(withVisit)
    .filter((a) => new Date(a.visit.scheduled_start).toDateString() === start.toDateString())
    .reduce((sum, a) => sum + (new Date(a.visit.scheduled_end) - new Date(a.visit.scheduled_start)) / 60000, 0);
  if (sameDayMinutes > 600) warnings.push('Over 10 hours scheduled that day');

  const va = {
    id: Math.max(0, ...assignments.map((a) => a.id)) + 1,
    visit_id: visit.id,
    employee_id: employee.id,
    lifecycle_state: 'scheduled',
    assignment_status: 'assigned',
    actual_start: null,
    actual_end: null,
    worked_minutes: null,
    flags: [],
  };
  assignments = [...assignments, va];
  return { ...va, warnings };
}

export async function withdrawAssignment(id) {
  await delay(240);
  assignments = assignments.map((a) =>
    String(a.id) === String(id)
      ? { ...a, assignment_status: 'withdrawn', lifecycle_state: 'cancelled' }
      : a
  );
  return null;
}

export async function copyRota() {
  await delay(500);
  return { created: 12 };
}

/* -------------------------------- People ---------------------------------- */

export async function listEmployees() {
  await delay(220);
  return employees.slice().sort((a, b) => a.last_name.localeCompare(b.last_name));
}

export async function getEmployee(id) {
  await delay(160);
  return employees.find((e) => String(e.id) === String(id));
}

export async function inviteEmployee(payload) {
  await delay(420);
  const e = {
    id: Math.max(...employees.map((x) => x.id)) + 1,
    ...payload,
    full_name: `${payload.first_name} ${payload.last_name}`,
    active: true,
    mfa_enabled: false,
  };
  employees = [...employees, e];
  return e;
}

export async function updateEmployee(id, payload) {
  await delay(280);
  employees = employees.map((e) =>
    String(e.id) === String(id)
      ? { ...e, ...payload, full_name: `${payload.first_name ?? e.first_name} ${payload.last_name ?? e.last_name}` }
      : e
  );
  return employees.find((e) => String(e.id) === String(id));
}

export async function listServiceUsers() {
  await delay(220);
  return serviceUsers.slice().sort((a, b) => a.last_name.localeCompare(b.last_name));
}

export async function createServiceUser(payload) {
  await delay(360);
  const su = {
    id: Math.max(...serviceUsers.map((x) => x.id)) + 1,
    ...payload,
    full_name: `${payload.first_name} ${payload.last_name}`,
    active: true,
  };
  serviceUsers = [...serviceUsers, su];
  return su;
}

export async function updateServiceUser(id, payload) {
  await delay(280);
  serviceUsers = serviceUsers.map((s) => (String(s.id) === String(id) ? { ...s, ...payload } : s));
  return serviceUsers.find((s) => String(s.id) === String(id));
}

export async function listCarePackages() {
  await delay(200);
  return carePackages;
}

/* ------------------------------ Timesheets -------------------------------- */

export async function listTimesheetPeriods() {
  await delay(240);
  return periods;
}

export async function getTimesheetPeriod(id) {
  await delay(300);
  const period = periods.find((p) => String(p.id) === String(id));
  const lines = employees.slice(0, 4).map((e, i) => ({
    id: 9100 + i,
    timesheet_period_id: period.id,
    employee_id: e.id,
    visit_assignment_id: 100 + i,
    work_date: isoDay(-i),
    scheduled_minutes: 90 + i * 30,
    worked_minutes: 92 + i * 28,
    break_minutes: 0,
    flags: i === 1 ? ['late_start'] : [],
    employee: e,
  }));
  return { ...period, lines };
}

export async function approvePeriod(id) {
  await delay(400);
  periods = periods.map((p) =>
    String(p.id) === String(id)
      ? { ...p, status: 'approved', approved_at: new Date().toISOString() }
      : p
  );
  return periods.find((p) => String(p.id) === String(id));
}

export async function lockPeriod(id) {
  await delay(400);
  periods = periods.map((p) =>
    String(p.id) === String(id) ? { ...p, status: 'locked', locked_at: new Date().toISOString() } : p
  );
  return periods.find((p) => String(p.id) === String(id));
}

export async function listDisputes() {
  await delay(220);
  return disputes.map((d) => ({
    ...d,
    employee: employees.find((e) => e.id === d.raised_by_employee_id),
  }));
}

export async function resolveDispute(id, note) {
  await delay(300);
  disputes = disputes.map((d) =>
    String(d.id) === String(id) ? { ...d, state: 'resolved', resolution_note: note } : d
  );
  return disputes.find((d) => String(d.id) === String(id));
}

/* ------------------------------- Settings --------------------------------- */

export async function getSettings() {
  await delay(200);
  return settings;
}

export async function updateSettings(payload) {
  await delay(320);
  settings = { ...settings, ...payload };
  return settings;
}

export { employees as mockEmployees, serviceUsers as mockServiceUsers };
