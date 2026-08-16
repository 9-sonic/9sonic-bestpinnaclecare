// Shared display helpers for the office screens.

export const LIFECYCLE_LABELS = {
  scheduled: 'Scheduled',
  check_in_window: 'Due now',
  grace_period: 'Grace period',
  late: 'Late',
  in_progress: 'On shift',
  overdue: 'Overdue',
  pending_review: 'Needs review',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

// Which states the office should act on, in the order they matter.
export const ATTENTION_ORDER = ['missed', 'overdue', 'late', 'pending_review'];

export const LIFECYCLE_TONE = {
  scheduled: 'neutral',
  check_in_window: 'info',
  grace_period: 'warn',
  late: 'warn',
  in_progress: 'active',
  overdue: 'danger',
  pending_review: 'warn',
  completed: 'success',
  missed: 'danger',
  cancelled: 'neutral',
};

export function fullName(person) {
  if (!person) return '';
  return person.full_name ?? [person.first_name, person.last_name].filter(Boolean).join(' ');
}

export function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeRange(a, b) {
  return `${formatTime(a)} to ${formatTime(b)}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function isoDate(d) {
  // Local Y-M-D, NOT toISOString() — the latter converts to UTC first, which in a
  // positive-offset zone (e.g. BST, UTC+1) rolls local midnight back to the
  // previous day and drops the last day of the range. That silently excluded
  // Sunday's visits from the rota's from..to window.
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Monday-first week containing the given date.
export function weekOf(date = new Date()) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday, from: isoDate(monday), to: isoDate(sunday) };
}

export function minutesToHours(mins) {
  if (mins == null) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function addressOf(su) {
  if (!su) return '';
  return [su.address_line1, su.address_line2, su.city, su.postcode].filter(Boolean).join(', ');
}
