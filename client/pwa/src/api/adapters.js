// ---------------------------------------------------------------------------
// Translation between the API's shapes and the flatter shapes the screens use.
//
// The backend models a booking as three nested records: a VisitAssignment (this
// carer, doing this work) wrapping a Visit (the booking) wrapping a ServiceUser
// (the person receiving care). The UI only ever wants one flat "shift", so the
// mapping happens here rather than in fifteen components.
//
// Two things worth knowing before changing this file:
//
// 1. `id` on the flat shift is the VISIT ASSIGNMENT id, not the visit id. Every
//    clock call is keyed on the assignment, so this is the id that matters.
// 2. The API has ten lifecycle states. The UI has three. The mapping below is
//    deliberate: anything the carer has not started yet reads as upcoming, and
//    anything that needs the office to look at it reads as completed, because
//    the carer's work on it is done either way.
// ---------------------------------------------------------------------------

// lifecycle_state -> the three states the UI draws.
const UI_STATUS = {
  scheduled: 'upcoming',
  check_in_window: 'upcoming',
  grace_period: 'upcoming',
  late: 'upcoming',
  in_progress: 'active',
  overdue: 'active',
  pending_review: 'completed',
  completed: 'completed',
  missed: 'completed',
  cancelled: 'completed',
};

// States the carer should be nudged about, surfaced as a flag on the shift.
const ATTENTION_STATES = new Set(['late', 'overdue', 'missed', 'pending_review']);

export function uiStatus(lifecycleState) {
  return UI_STATUS[lifecycleState] ?? 'upcoming';
}

function addressOf(su) {
  if (!su) return '';
  return [su.address_line1, su.address_line2, su.city, su.postcode].filter(Boolean).join(', ');
}

// VisitAssignment (with nested visit + service_user) -> flat shift for the UI.
export function toShift(va) {
  if (!va) return null;
  const visit = va.visit ?? {};
  const su = visit.service_user ?? null;

  return {
    // Assignment id: what clocking and navigation key off.
    id: String(va.id),
    visitId: visit.id,
    employeeId: va.employee_id,

    client: su?.full_name ?? [su?.first_name, su?.last_name].filter(Boolean).join(' ') ?? 'Unknown',
    clientPhone: su?.phone ?? null,
    address: addressOf(su),
    accessNotes: su?.access_notes ?? null,

    startsAt: visit.scheduled_start ?? null,
    endsAt: visit.scheduled_end ?? null,
    clockInAt: va.actual_start ?? null,
    clockOutAt: va.actual_end ?? null,
    workedMinutes: va.worked_minutes ?? null,

    status: uiStatus(va.lifecycle_state),
    lifecycleState: va.lifecycle_state,
    needsAttention: ATTENTION_STATES.has(va.lifecycle_state),
    flags: va.flags ?? [],

    // Kept for the offline geofence check and the map screen.
    geo: su?.lat != null && su?.lng != null
      ? { lat: Number(su.lat), lng: Number(su.lng), radius: su.geofence_radius_m ?? 150 }
      : null,

    // The API has no per-visit carer notes or task list yet. See api_missing.md.
    note: visit.notes ?? null,
    carePlan: [],
    tasks: [],
    visitNote: '',
  };
}

export const toShifts = (list = []) => list.map(toShift).filter(Boolean);

// Employee -> the user object the UI renders.
export function toUser(employee) {
  if (!employee) return null;
  return {
    id: employee.id,
    name:
      employee.full_name ??
      [employee.first_name, employee.last_name].filter(Boolean).join(' '),
    firstName: employee.first_name,
    lastName: employee.last_name,
    email: employee.email,
    phone: employee.phone ?? null,
    role: employee.role === 'senior_carer' ? 'Senior Carer' : 'Care Giver',
    rawRole: employee.role,
    staffId: employee.employee_reference ?? String(employee.id),
    active: employee.active,
    mfaEnabled: employee.mfa_enabled,
    avatar: null,
  };
}

// Notification -> the UI's notification card.
const NOTIFICATION_LINKS = {
  VisitAssignment: (id) => `/shifts/${id}`,
  Visit: () => '/shifts',
  Conversation: (id) => `/messages/${id}`,
  Message: () => '/messages',
  TimesheetPeriod: () => '/timesheet',
};

export function toNotification(n) {
  return {
    id: String(n.id),
    type: n.notification_type,
    title: n.title,
    text: n.body ?? '',
    at: n.created_at,
    read: Boolean(n.seen_at),
    link: NOTIFICATION_LINKS[n.subject_type]?.(n.subject_id) ?? null,
  };
}

export const toNotifications = (list = []) => list.map(toNotification);

// Conversation -> the UI's thread row. The API returns participants as
// {type, id} pairs, so the display name is resolved by the caller which knows
// who the viewer is.
export function toThread(convo, { viewerType, viewerId, nameFor } = {}) {
  const others = (convo.participants ?? []).filter(
    (p) => !(p.type === viewerType && p.id === viewerId)
  );
  const title =
    convo.title ??
    others.map((p) => nameFor?.(p) ?? `${p.type} ${p.id}`).join(', ') ??
    'Conversation';

  return {
    id: String(convo.id),
    name: title,
    role: convo.kind === 'group' ? 'Group' : '',
    online: false, // No presence in the API. See api_missing.md.
    unread: convo.unread_count ?? 0,
    lastAt: convo.last_message_at,
    preview: '',
    participants: convo.participants ?? [],
  };
}

export const toThreads = (list = [], ctx) => list.map((c) => toThread(c, ctx));

export function toMessage(m, { viewerType, viewerId } = {}) {
  return {
    id: String(m.id),
    mine: m.sender_type === viewerType && m.sender_id === viewerId,
    text: m.body ?? '',
    at: m.created_at,
    clientMessageId: m.client_message_id,
  };
}

export const toMessages = (list = [], ctx) => list.map((m) => toMessage(m, ctx));

// Timesheet lines -> the summary the Timesheet screen draws. Pay rates and
// mileage do not exist in the API yet, so money is left out rather than guessed.
export function toTimesheet(lines = []) {
  const entries = lines.map((l) => ({
    id: String(l.id),
    visitAssignmentId: l.visit_assignment_id,
    workDate: l.work_date,
    scheduledMinutes: l.scheduled_minutes,
    workedMinutes: l.worked_minutes,
    breakMinutes: l.break_minutes,
    flags: l.flags ?? [],
    hours: Math.round(((l.worked_minutes ?? 0) / 60) * 100) / 100,
  }));

  const totalMinutes = entries.reduce((sum, e) => sum + (e.workedMinutes ?? 0), 0);

  return {
    entries,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
  };
}

// Derives the Home screen figures from whatever the carer has this week.
export function summarise(shifts = [], timesheet = { entries: [], totalHours: 0 }) {
  const completed = shifts.filter((s) => s.status === 'completed');
  const clients = new Set(shifts.map((s) => s.client)).size;

  return {
    week: {
      hoursWorked: Math.round(timesheet.totalHours),
      hoursTarget: 40, // Contracted hours are not in the API. See api_missing.md.
      shifts: shifts.length,
      hours: timesheet.totalHours,
      clients,
      completed: completed.length,
    },
  };
}
