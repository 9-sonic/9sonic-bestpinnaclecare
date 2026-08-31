// Shared display helpers for the office screens.
import { fromZonedTime } from 'date-fns-tz';

const UK_ZONE = 'Europe/London';

// Build a UTC instant for a UK wall-clock time on a given day. The picked time
// ("09:00") always means 09:00 in the UK, regardless of the admin's own zone
// (e.g. Kenya) — care happens in the UK. `base` is a Date whose Y-M-D we use;
// `t` is "HH:MM"; `dayOffset` shifts the day (for overnight ends). Returns a
// Date (call .toISOString() to send). This replaces `new Date(); setHours()`,
// which wrongly interpreted the time in the browser's local zone.
export function ukTime(base, t, dayOffset = 0) {
  const pad = (n) => String(n).padStart(2, '0');
  const [h, m] = t.split(':').map(Number);
  const stamp = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate() + dayOffset)}T${pad(h)}:${pad(m)}:00`;
  return fromZonedTime(stamp, UK_ZONE);
}

// Full UK-timezone date, e.g. "Mon 8 Sep 2026". Use for any visit/clock date so
// it reads in UK time, not the admin's local zone.
export function formatDateFull(iso, opts = {}) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: UK_ZONE, ...opts });
}

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

// Every visit time is shown in UK time (Europe/London) regardless of where the
// admin's browser is — a Kenya admin must see the same clock as the office and
// the carer. Pinning the timeZone here fixes it across the whole console.
export function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: UK_ZONE });
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
    timeZone: UK_ZONE,
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
