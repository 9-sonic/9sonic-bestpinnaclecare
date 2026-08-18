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
  late: 'active',
  in_progress: 'active',
  overdue: 'active',
  pending_review: 'completed',
  completed: 'completed',
  missed: 'completed',
  cancelled: 'completed',
};

// States the carer should be nudged about, surfaced as a flag on the shift.
const ATTENTION_STATES = new Set(['late', 'overdue', 'missed', 'pending_review']);

export function uiStatus(lifecycleState, va) {
  // `pending_review` is used both after a late clock-IN (carer is still working)
  // and after a clock-OUT with an anomaly (shift is done). The static map can't
  // tell them apart, so check the actual times: if the carer has clocked in but
  // not out, they are still on shift.
  if (lifecycleState === 'pending_review' && va?.actual_start && !va?.actual_end) {
    return 'active';
  }
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

    status: uiStatus(va.lifecycle_state, va),
    lifecycleState: va.lifecycle_state,
    needsAttention: ATTENTION_STATES.has(va.lifecycle_state),
    flags: va.flags ?? [],

    // Kept for the offline geofence check and the map screen.
    geo: su?.lat != null && su?.lng != null
      ? { lat: Number(su.lat), lng: Number(su.lng), radius: su.geofence_radius_m ?? 150 }
      : null,

    // The list endpoint carries none of these. GET /staff/visit_assignments/:id
    // does — see toShiftDetail.
    note: visit.notes ?? null,
    carePlan: [],
    tasks: [],
    visitNote: '',
  };
}

export const toShifts = (list = []) => list.map(toShift).filter(Boolean);

// ---------------------------------------------------------------------------
// GET /staff/visit_assignments/:id returns the assignment plus care_plan, tasks
// and notes. The spec types those three as bare objects, so the item shapes are
// undocumented — these mappers read the field names the serializers emit and
// fall back rather than throw. Once the shapes are pinned down in the OpenAPI
// doc, tighten them.
// ---------------------------------------------------------------------------
export function toCarePlanItem(item, i) {
  return {
    id: String(item?.id ?? i),
    category: item?.category ?? 'general',
    label: item?.label ?? item?.title ?? '',
    detail: item?.detail ?? item?.description ?? '',
  };
}

export function toVisitTask(task, i) {
  return {
    id: String(task?.id ?? i),
    label: task?.label ?? task?.title ?? '',
    done: Boolean(task?.done ?? task?.completed_at),
    carePlanItemId: task?.care_plan_item_id ?? null,
  };
}

// Notes are append-only: an edit adds a row that supersedes the previous one,
// so the newest entry is the current text and the rest are history.
export function toVisitNotes(list = []) {
  const notes = [...list].sort(
    (a, b) => new Date(b?.created_at ?? 0) - new Date(a?.created_at ?? 0)
  );
  return {
    current: notes[0]?.body ?? '',
    history: notes.map((n, i) => ({
      id: String(n?.id ?? i),
      body: n?.body ?? '',
      at: n?.created_at ?? null,
    })),
  };
}

export function toShiftDetail(payload) {
  const shift = toShift(payload);
  if (!shift) return null;

  const notes = toVisitNotes(payload.notes ?? []);

  return {
    ...shift,
    carePlan: (payload.care_plan ?? []).map(toCarePlanItem),
    tasks: (payload.tasks ?? []).map(toVisitTask),
    visitNote: notes.current,
    noteHistory: notes.history,
  };
}

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
    avatar: employee.avatar_url ?? null,

    // PATCH /staff/me accepts these two, so the carer can set them. They are
    // not in the documented Employee schema, so whether they come back on a
    // read is unconfirmed against the OpenAPI doc.
    emergencyContactName: employee.emergency_contact_name ?? null,
    emergencyContactPhone: employee.emergency_contact_phone ?? null,

    // Only present once contracted hours exist on the employee record. The
    // Home screen falls back to the API summary, then to 40.
    contractedHoursPerWeek: employee.contracted_hours_per_week ?? null,
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

// Conversation -> the UI's thread row.
//
// The conversations endpoint now embeds participant names, so `full_name` is
// preferred. `nameFor` remains as a second choice for the mock path, and the
// "Admin 2" style label is the last resort: a thread with a visible label is
// better than a blank row, and it is obvious enough to report.
export function toThread(convo, { viewerType, viewerId, nameFor } = {}) {
  const others = (convo.participants ?? []).filter(
    (p) => !(p.type === viewerType && p.id === viewerId)
  );

  const label = (p) => p?.full_name ?? p?.name ?? nameFor?.(p) ?? `${p?.type} ${p?.id}`;
  const title = convo.title || others.map(label).join(', ') || 'Conversation';

  // The list groups threads by what they are. The API's `kind` is the source
  // of that; it was being collapsed into a "Group" label and otherwise thrown
  // away, so every thread arrived at the UI looking like a direct message.
  //
  // `group` is the API's word for a channel. Anything unrecognised falls back
  // to direct, so a new kind added server-side still shows up in the list
  // rather than vanishing out of every group.
  const kind =
    convo.kind === 'group'
      ? 'channel'
      : convo.kind === 'client'
        ? 'client'
        : 'direct';

  // The line under the name, saying what the thread is. A channel says how
  // many people are in it; a direct thread says who the person is.
  const memberCount = (convo.participants ?? []).length;
  const subtitle =
    convo.subtitle ??
    (kind === 'channel'
      ? `${memberCount} member${memberCount === 1 ? '' : 's'}`
      : kind === 'client'
        ? 'Client thread'
        : others.map((p) => p?.job_title).filter(Boolean)[0] ?? '');

  return {
    id: String(convo.id),
    name: title,
    // The other person's picture for a direct thread (initials fall back in
    // the Avatar). Channels/groups use the first other member as a stand-in.
    avatar: others[0]?.avatar_url ?? null,
    kind,
    subtitle,
    pinned: !!convo.pinned,
    role: kind === 'channel' ? 'Group' : '',
    online: false, // No presence in the API.
    unread: convo.unread_count ?? 0,
    lastAt: convo.last_message_at,
    preview: convo.last_message_preview ?? '',
    participants: convo.participants ?? [],
  };
}

export const toThreads = (list = [], ctx) => list.map((c) => toThread(c, ctx));

// `participants` is the conversation's participant list (id_type, id, full_name),
// the same shape ConversationSerializer embeds. MessageSerializer has never sent
// a sender name or nested sender object — only sender_type/sender_id — so a
// thread with more than two people (any channel/group) rendered every bubble
// unattributed. Matching sender_type+sender_id against the conversation's own
// participants is the fix, and it works for every thread kind because it does
// not depend on the API ever adding a field it does not have today.
function senderIn(participants, m) {
  return (participants ?? []).find((p) => p.type === m.sender_type && p.id === m.sender_id);
}

export function toMessage(m, { viewerType, viewerId, participants, nameFor } = {}) {
  const mine = m.sender_type === viewerType && m.sender_id === viewerId;
  const sender = !mine ? senderIn(participants, m) : null;
  return {
    id: String(m.id),
    mine,
    text: m.body ?? '',
    at: m.created_at,
    // Who said it, for the label above the bubble. It only gets drawn on
    // other people's messages, and it matters in a channel where several
    // people post; a thread of unattributed bubbles is unreadable.
    senderName:
      m.sender_name ??
      m.sender?.full_name ??
      m.sender?.name ??
      sender?.full_name ??
      sender?.name ??
      (sender ? nameFor?.(sender) : undefined) ??
      '',
    // Only ever shown on your own messages. Reporting that you have read
    // someone else's message back to yourself is noise.
    readAt: m.read_at ?? null,
    clientMessageId: m.client_message_id,
  };
}

// The API returns the newest 50 messages descending; a chat reads oldest-top,
// newest-bottom, and optimistic/realtime sends are appended at the end — so
// flip to ascending here to keep everything in one consistent order.
export const toMessages = (list = [], ctx) =>
  [...list]
    .sort((a, b) => new Date(a.created_at ?? a.at ?? 0) - new Date(b.created_at ?? b.at ?? 0))
    .map((m) => toMessage(m, ctx));

// ---------------------------------------------------------------------------
// Availability.
//
// The API stores one row per weekday per slot: { weekday, slot, available },
// weekday 0 = Monday. The screen thinks in days holding a list of slots they
// can work. These two convert between them.
//
// `night` is in the API's enum but has no control on the Availability screen.
// Rather than assert `night: false` on every save — which would silently wipe a
// value the carer cannot see, let alone have set — whatever the server already
// holds for it is preserved. Still open with the team: either the screen grows
// a Night row or the enum drops it.
// ---------------------------------------------------------------------------
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const API_SLOTS = ['morning', 'afternoon', 'evening', 'night'];
// The three the Availability screen actually renders.
export const UI_SLOTS = ['morning', 'afternoon', 'evening'];

// The GET response shape is not documented ("weekly pattern"), so this accepts
// the three plausible ones rather than guessing which landed.
export function toAvailabilityDays(payload) {
  const days = Object.fromEntries(WEEKDAY_KEYS.map((k) => [k, []]));
  if (!payload) return days;

  const entries = Array.isArray(payload) ? payload : (payload.entries ?? payload.availability);

  if (Array.isArray(entries)) {
    entries.forEach((e) => {
      if (e?.available === false) return;
      const key = WEEKDAY_KEYS[e?.weekday];
      if (key && e?.slot && !days[key].includes(e.slot)) days[key].push(e.slot);
    });
    return days;
  }

  // Already keyed by day name.
  WEEKDAY_KEYS.forEach((k) => {
    if (Array.isArray(payload[k])) days[k] = [...payload[k]];
  });
  return days;
}

// `previous` is the last payload from GET, used only to carry `night` through.
export function toAvailabilityEntries(days = {}, previous = null) {
  const prior = previous ? toAvailabilityDays(previous) : null;

  return WEEKDAY_KEYS.flatMap((key, weekday) => {
    const chosen = days[key] ?? [];
    return API_SLOTS.map((slot) => ({
      weekday,
      slot,
      available: UI_SLOTS.includes(slot)
        ? chosen.includes(slot)
        : Boolean(prior?.[key]?.includes(slot)),
    }));
  });
}

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

// ---------------------------------------------------------------------------
// GET /staff/summary -> the Home and Overview figures.
//
// This replaces deriving the same numbers from the visit list plus the
// timesheet, which was two round trips on a phone every time the Home screen
// opened. `by_weekday` is typed as a bare object in the spec, so the series are
// read defensively and fall back to zeros rather than breaking the chart.
// ---------------------------------------------------------------------------
const zeros = () => Array(7).fill(0);

function series(source, key) {
  const values = source?.[key];
  if (!Array.isArray(values) || values.length !== 7) return zeros();
  return values.map((n) => (Number.isFinite(Number(n)) ? Number(n) : 0));
}

export function toSummary(payload = {}) {
  const workedMinutes = payload.hours_worked_minutes ?? 0;
  const contractedMinutes = payload.contracted_minutes ?? null;
  const hours = Math.round((workedMinutes / 60) * 100) / 100;

  return {
    week: {
      hoursWorked: Math.round(hours),
      hours,
      // 40 remains the fallback only while contracted hours are unset on the
      // employee record. It is an assumption, not a contract figure.
      hoursTarget: contractedMinutes ? Math.round(contractedMinutes / 60) : 40,
      shifts: payload.visits_count ?? 0,
      clients: payload.clients_count ?? 0,
      miles: payload.miles ?? 0,
    },
    weekly: {
      hours: series(payload.by_weekday, 'hours').map((h) => Math.round(h * 10) / 10),
      visits: series(payload.by_weekday, 'visits'),
      miles: series(payload.by_weekday, 'miles'),
    },
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
