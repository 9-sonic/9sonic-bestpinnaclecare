// Stand-in data for demo mode, held in localStorage.
//
// Everything here mirrors the shapes the Rails API actually returns, field for
// field, including the nesting (visit_assignment -> visit -> service_user) and
// the snake_case keys. That is the point: demo mode exercises the same adapters
// and the same screens as the live API, so switching over is only an env change
// rather than a round of surprises.
//
// Delete this folder once the API is the only source.

const DB_KEY = 'bpc.mock.db.v4';

function at(hour, minute = 0, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const isoDay = (dayOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
};

// Matches ServiceUserSerializer.
const serviceUsers = [
  {
    id: 1,
    first_name: 'Edith',
    last_name: 'Thornbury',
    full_name: 'Edith Thornbury',
    reference: 'SU-1042',
    phone: '+441132960001',
    address_line1: '12 Rosewood Avenue',
    address_line2: null,
    city: 'Leeds',
    postcode: 'LS8 3AB',
    lat: 53.8225,
    lng: -1.5203,
    geofence_radius_m: 150,
    geofence_mode: 'block',
    access_notes: 'Key safe by the back door, code 4417. Dog is friendly.',
    active: true,
  },
  {
    id: 2,
    first_name: 'Harold',
    last_name: 'Greaves',
    full_name: 'Harold Greaves',
    reference: 'SU-1088',
    phone: '+441132960002',
    address_line1: '8 Canal Street',
    address_line2: 'Flat 2',
    city: 'Leeds',
    postcode: 'LS1 4RT',
    lat: 53.7955,
    lng: -1.5491,
    geofence_radius_m: 150,
    geofence_mode: 'warn',
    access_notes: 'Buzzer number 2. Allow time, he is slow to the door.',
    active: true,
  },
  {
    id: 3,
    first_name: 'Maud',
    last_name: 'Fenwick',
    full_name: 'Maud Fenwick',
    reference: 'SU-1120',
    phone: '+441132960003',
    address_line1: '4 Kiln Lane',
    address_line2: null,
    city: 'Leeds',
    postcode: 'LS6 2QP',
    lat: 53.8102,
    lng: -1.5615,
    geofence_radius_m: 200,
    geofence_mode: 'block',
    access_notes: 'Family usually present in the morning.',
    active: true,
  },
  {
    id: 4,
    first_name: 'Priya',
    last_name: 'Sharma',
    full_name: 'Priya Sharma',
    reference: 'SU-1155',
    phone: '+441132960004',
    address_line1: '88 Beech Avenue',
    address_line2: null,
    city: 'Leeds',
    postcode: 'LS6 2QP',
    lat: 53.8188,
    lng: -1.5722,
    geofence_radius_m: 150,
    geofence_mode: 'block',
    access_notes: null,
    active: true,
  },
];

// Matches VisitAssignmentSerializer, including the nested visit.
function assignment({ id, visitId, suId, start, end, state, actualStart, actualEnd, worked, flags }) {
  return {
    id,
    visit_id: visitId,
    employee_id: 1,
    lifecycle_state: state,
    assignment_status: 'assigned',
    actual_start: actualStart ?? null,
    actual_end: actualEnd ?? null,
    worked_minutes: worked ?? null,
    flags: flags ?? [],
    visit: {
      id: visitId,
      service_user_id: suId,
      scheduled_start: start,
      scheduled_end: end,
      status: 'published',
      staff_required: 1,
      published_at: at(9, 0, -7),
      notes: null,
      service_user: serviceUsers.find((s) => s.id === suId),
    },
  };
}

function seed() {
  return {
    // Matches EmployeeSerializer.
    employee: {
      id: 1,
      email: 'carer@bestpinnacle.test',
      first_name: 'Cara',
      last_name: 'Erikson',
      full_name: 'Cara Erikson',
      role: 'carer',
      employee_reference: 'EMP-2274',
      active: true,
      mfa_enabled: false,
      phone: '07700 900112',
    },

    visit_assignments: [
      assignment({ id: 101, visitId: 501, suId: 3, start: at(7, 0), end: at(8, 0), state: 'completed', actualStart: at(7, 1), actualEnd: at(8, 4), worked: 63 }),
      assignment({ id: 102, visitId: 502, suId: 1, start: at(9, 30), end: at(11, 0), state: 'scheduled' }),
      assignment({ id: 103, visitId: 503, suId: 2, start: at(13, 30), end: at(14, 30), state: 'scheduled' }),
      assignment({ id: 104, visitId: 504, suId: 4, start: at(16, 0), end: at(17, 30), state: 'scheduled' }),
      assignment({ id: 105, visitId: 505, suId: 1, start: at(9, 30, 1), end: at(11, 0, 1), state: 'scheduled' }),
      assignment({ id: 106, visitId: 506, suId: 3, start: at(7, 0, -1), end: at(8, 0, -1), state: 'completed', actualStart: at(7, 3, -1), actualEnd: at(8, 0, -1), worked: 57 }),
      assignment({ id: 107, visitId: 507, suId: 2, start: at(13, 30, -1), end: at(14, 30, -1), state: 'completed', actualStart: at(13, 35, -1), actualEnd: at(14, 40, -1), worked: 65, flags: ['late_start'] }),
      assignment({ id: 108, visitId: 508, suId: 4, start: at(9, 0, -2), end: at(11, 0, -2), state: 'completed', actualStart: at(9, 0, -2), actualEnd: at(11, 2, -2), worked: 122 }),
    ],

    // Matches TimesheetLineSerializer.
    timesheet_lines: [
      { id: 9001, timesheet_period_id: 70, employee_id: 1, visit_assignment_id: 101, work_date: isoDay(0), scheduled_minutes: 60, worked_minutes: 63, break_minutes: 0, flags: [] },
      { id: 9002, timesheet_period_id: 70, employee_id: 1, visit_assignment_id: 106, work_date: isoDay(-1), scheduled_minutes: 60, worked_minutes: 57, break_minutes: 0, flags: ['short'] },
      { id: 9003, timesheet_period_id: 70, employee_id: 1, visit_assignment_id: 107, work_date: isoDay(-1), scheduled_minutes: 60, worked_minutes: 65, break_minutes: 0, flags: ['late_start'] },
      { id: 9004, timesheet_period_id: 70, employee_id: 1, visit_assignment_id: 108, work_date: isoDay(-2), scheduled_minutes: 120, worked_minutes: 122, break_minutes: 0, flags: [] },
      { id: 9005, timesheet_period_id: 70, employee_id: 1, visit_assignment_id: 109, work_date: isoDay(-3), scheduled_minutes: 180, worked_minutes: 175, break_minutes: 15, flags: [] },
    ],

    // Matches ConversationSerializer.
    conversations: [
      { id: 301, kind: 'direct', title: null, direct_key: 'Admin:2:Employee:1', last_message_at: at(9, 22, -1), unread_count: 2, participants: [ { type: 'Admin', id: 2, role: 'member' }, { type: 'Employee', id: 1, role: 'member' } ] },
      { id: 302, kind: 'direct', title: null, direct_key: 'Admin:3:Employee:1', last_message_at: at(18, 5, -1), unread_count: 1, participants: [ { type: 'Admin', id: 3, role: 'member' }, { type: 'Employee', id: 1, role: 'member' } ] },
      { id: 303, kind: 'group', title: 'Leeds North team', direct_key: null, last_message_at: at(16, 33, -2), unread_count: 0, participants: [ { type: 'Admin', id: 4, role: 'owner' }, { type: 'Employee', id: 1, role: 'member' }, { type: 'Employee', id: 5, role: 'member' } ] },
    ],

    // Matches MessageSerializer.
    messages: {
      301: [
        { id: 4001, conversation_id: 301, sender_type: 'Admin', sender_id: 2, body: 'Good morning. How did the call with Maud go?', client_message_id: 'm-4001', created_at: at(9, 12, -1), edited_at: null, deleted_at: null },
        { id: 4002, conversation_id: 301, sender_type: 'Employee', sender_id: 1, body: 'All fine, she had breakfast and took her tablets.', client_message_id: 'm-4002', created_at: at(9, 14, -1), edited_at: null, deleted_at: null },
        { id: 4003, conversation_id: 301, sender_type: 'Admin', sender_id: 2, body: 'Lovely. Edith has asked if you can come 15 minutes earlier tomorrow.', client_message_id: 'm-4003', created_at: at(9, 20, -1), edited_at: null, deleted_at: null },
        { id: 4004, conversation_id: 301, sender_type: 'Employee', sender_id: 1, body: 'That works, I will be there for 09:15.', client_message_id: 'm-4004', created_at: at(9, 22, -1), edited_at: null, deleted_at: null },
      ],
      302: [
        { id: 4010, conversation_id: 302, sender_type: 'Admin', sender_id: 3, body: 'Next week rota is published.', client_message_id: 'm-4010', created_at: at(18, 5, -1), edited_at: null, deleted_at: null },
      ],
      303: [
        { id: 4020, conversation_id: 303, sender_type: 'Admin', sender_id: 4, body: 'Thanks everyone for covering the late calls this week.', client_message_id: 'm-4020', created_at: at(16, 30, -2), edited_at: null, deleted_at: null },
        { id: 4021, conversation_id: 303, sender_type: 'Employee', sender_id: 1, body: 'No problem at all.', client_message_id: 'm-4021', created_at: at(16, 33, -2), edited_at: null, deleted_at: null },
      ],
    },

    // Matches NotificationSerializer.
    notifications: [
      { id: 601, notification_type: 'visit_changed', title: 'Visit time changed', body: 'Edith Thornbury now starts at 09:15 tomorrow.', channel: 'in_app', status: 'delivered', alert_id: null, subject_type: 'VisitAssignment', subject_id: 105, seen_at: null, created_at: at(18, 20, -1) },
      { id: 602, notification_type: 'message', title: 'New message from Sarah Mensah', body: 'Edith has asked if you can come 15 minutes earlier.', channel: 'in_app', status: 'delivered', alert_id: null, subject_type: 'Conversation', subject_id: 301, seen_at: null, created_at: at(9, 20, -1) },
      { id: 603, notification_type: 'timesheet_reminder', title: 'Timesheet reminder', body: 'Check this week before Sunday 6pm.', channel: 'in_app', status: 'delivered', alert_id: null, subject_type: 'TimesheetPeriod', subject_id: 70, seen_at: at(8, 30, -2), created_at: at(8, 0, -2) },
      { id: 604, notification_type: 'training_due', title: 'Training due', body: 'Moving and handling refresher expires in 14 days.', channel: 'in_app', status: 'delivered', alert_id: null, subject_type: null, subject_id: null, seen_at: at(12, 5, -3), created_at: at(12, 0, -3) },
    ],

    notification_preferences: [
      { notification_type: 'visit_changed', in_app: true, push: true, email: false },
      { notification_type: 'message', in_app: true, push: true, email: false },
      { notification_type: 'timesheet_reminder', in_app: true, push: true, email: false },
    ],

    // Local only, no API equivalent yet.
    local: { visitNotes: {}, tasks: {}, breaks: {}, availability: null },
  };
}

// People behind participant references, so the chat list can show names.
// The API does not expose this, which is noted in api_missing.md.
const PARTICIPANT_NAMES = {
  'Admin:2': 'Sarah Mensah',
  'Admin:3': 'Daniel Okoye',
  'Admin:4': 'Amara Bello',
  'Employee:1': 'Cara Erikson',
  'Employee:5': 'Tom Whitfield',
};

export function participantName(p) {
  return PARTICIPANT_NAMES[`${p.type}:${p.id}`] ?? `${p.type} ${p.id}`;
}

export function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through and reseed */
  }
  const fresh = seed();
  saveDb(fresh);
  return fresh;
}

export function saveDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable, keep in memory for this session */
  }
}

export function resetDb() {
  const fresh = seed();
  saveDb(fresh);
  return fresh;
}
