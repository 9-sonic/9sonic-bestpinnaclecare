import api from './client.js';
import env from '../config/env.js';
import * as mock from '../mocks/mockApi.js';
import { toShifts, toTimesheet, summarise, toSummary } from './adapters.js';

// The Home and Overview figures come from GET /staff/summary in one call. They
// used to be derived from the visit list plus the timesheet — two round trips
// on a phone, every time the Home screen opened. That derivation is kept as a
// fallback for the mock path and for an API that does not have the route yet.

function weekRange(offsetWeeks = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(sunday) };
}

export async function getSummary() {
  const { from, to } = weekRange();

  if (!env.useMock) {
    try {
      return toSummary(await api.get('/staff/summary', { from, to }));
    } catch (error) {
      // Anything other than a missing route is a real failure the screen should
      // see. A 404 means this deployment predates the endpoint, so fall through
      // to working the numbers out the old way.
      if (error?.status !== 404) throw error;
    }
  }

  return deriveSummary({ from, to });
}

// The original derivation: visit list + timesheet, totalled client side.
async function deriveSummary({ from, to }) {
  const [visits, lines] = await Promise.all([
    env.useMock ? mock.listVisits({ from, to }) : api.get('/staff/visits', { from, to }),
    env.useMock ? mock.getTimesheet() : api.get('/staff/timesheet'),
  ]);

  const shifts = toShifts(visits);
  const timesheet = toTimesheet(lines);
  const { week } = summarise(shifts, timesheet);

  // Hours and visits per weekday, Monday first, for the Overview chart.
  const hours = Array(7).fill(0);
  const visitsPerDay = Array(7).fill(0);
  timesheet.entries.forEach((e) => {
    const day = (new Date(e.workDate).getDay() + 6) % 7;
    hours[day] += (e.workedMinutes ?? 0) / 60;
    visitsPerDay[day] += 1;
  });

  return {
    week,
    weekly: {
      hours: hours.map((h) => Math.round(h * 10) / 10),
      visits: visitsPerDay,
      // Mileage cannot be derived from visits or timesheet lines. The live
      // path gets it from /staff/summary; there is nothing to read here.
      miles: Array(7).fill(0),
    },
  };
}

// Recent clock activity, derived from assignments that carry actual times.
export async function listEvents() {
  const { from, to } = weekRange();
  const res = env.useMock
    ? await mock.listVisits({ from, to })
    : await api.get('/staff/visits', { from, to });

  const events = [];
  toShifts(res).forEach((s) => {
    if (s.clockOutAt) {
      events.push({ id: `${s.id}-out`, type: 'out', client: s.client, place: s.address, at: s.clockOutAt });
    }
    if (s.clockInAt) {
      events.push({ id: `${s.id}-in`, type: 'in', client: s.client, place: s.address, at: s.clockInAt });
    }
  });

  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);
}

// The full clock in/out history for the history screen, paired into visits so
// each row can show how long the visit ran.
//
// Two things the API does not give us, both noted in api_missing.md:
//
//   There is no verification flag on a clock event. "Verified" here means the
//   assignment reached a settled state; "Review" means the office has it
//   flagged as pending_review. That is an honest reading of what we have, but
//   it is not the same as the office having checked the location, and the UI
//   should not be read as claiming that.
//
//   There is no endpoint for history beyond the current week, so this is the
//   same week window as the rest of the screen. Paging needs a date range.
export async function listClockHistory() {
  const { from, to } = weekRange();
  const res = env.useMock
    ? await mock.listVisits({ from, to })
    : await api.get('/staff/visits', { from, to });

  const entries = [];
  toShifts(res).forEach((s) => {
    const state =
      s.lifecycleState === 'pending_review'
        ? 'review'
        : s.lifecycleState === 'missed'
          ? 'missing'
          : 'verified';

    // Minutes on site, when both ends exist.
    const worked =
      s.clockInAt && s.clockOutAt
        ? Math.round((new Date(s.clockOutAt) - new Date(s.clockInAt)) / 60000)
        : null;

    if (s.clockOutAt) {
      entries.push({
        id: `${s.id}-out`,
        kind: 'out',
        client: s.client,
        place: s.address,
        at: s.clockOutAt,
        state,
        minutes: worked,
      });
    }
    if (s.clockInAt) {
      entries.push({
        id: `${s.id}-in`,
        kind: 'in',
        client: s.client,
        place: s.address,
        at: s.clockInAt,
        state,
        // An open shift has no duration yet, which the row says rather than
        // showing a running total that would be wrong the moment it renders.
        minutes: s.clockOutAt ? null : 'open',
      });
    }
  });

  return entries.sort((a, b) => new Date(b.at) - new Date(a.at));
}

export async function getTimesheet() {
  const lines = env.useMock ? await mock.getTimesheet() : await api.get('/staff/timesheet');
  return toTimesheet(lines);
}

// Raise a query against a timesheet line.
export function raiseDispute({ timesheetLineId, reason }) {
  if (env.useMock) return mock.raiseDispute({ timesheetLineId, reason });
  return api.post('/staff/disputes', { timesheet_line_id: timesheetLineId, reason });
}
