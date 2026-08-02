// Formatting helpers for dates, times and durations shown in the UI.

export function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeRange(startIso, endIso) {
  return `${formatTime(startIso)}  to  ${formatTime(endIso)}`;
}

// HH:MM:SS for the on-shift timer.
export function formatElapsed(ms) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// "Today, 15 May" / "Mon, 12 May"
export function formatDayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (sameDay) return `Today, ${date}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })}, ${date}`;
}

// 24 hour, matching every other time in the app. Care rotas are written in
// 24 hour time, so mixing in a 12 hour clock here would be a small but real
// source of confusion.
export function formatChatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatLocation(loc) {
  if (!loc) return 'No location captured';
  return `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
}
