import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listVisits, listEmployees, listServiceUsers, getSettings,
  assignEmployee, withdrawAssignment, reassignAssignment,
  publishVisit, generateVisits, createVisit, editVisit, exportRota,
  getVisit, listVisitEvents, cancelVisit, deleteVisit, broadcastCover,
} from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import Modal from '../components/common/Modal.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LIFECYCLE_LABELS, formatTime, formatDateFull, fullName, addressOf,
  weekOf, isoDate, ukTime, ukDay,
} from '../api/format.js';
import { Button, ExportButton, Tag } from '../ds/console.jsx';

/* ==========================================================================
   Rota console — a port of the RoundSys rota reference the office already uses
   (`rota-console.html`), wired to real visits, carers and endpoints.

   Two deliberate departures from the reference file:

   1. NO LEFT RAIL. Everything the reference keeps in its 216px rail — the
      unfilled alert, the filters, the status chips, the options toggle and the
      week stats — sits in the command bar at the top instead. Asked for
      explicitly; the console's own shell already owns the left edge.
   2. The reference is a mock: its actions raise toasts against sample data.
      Every action here calls a real endpoint (assign / reassign / withdraw /
      retime / cancel / delete / publish / advertise), so anything the backend
      has no concept of is NOT drawn rather than faked. See NOT-BUILT below.

   NOT BUILT, and why (all confirmed with the owner 2026-09-04):
     · Standby status      — the Visit lifecycle has no standby state.
     · Training placements — no trainee/shadowing concept on an assignment.
     · Travel-time gaps    — no travel or journey data to compute a gap from.
   The reference's "Show standby" and "Travel time gaps" toggles are therefore
   absent; "Flag double-booking" is real and is kept.

   Two things break a naive calendar for domiciliary care, and both are handled
   the way the reference does:
     1. 24h LIVE-IN shifts don't go in the timeline — they sit in a band at the
        top (one chip per day). In the grid they'd swallow a whole lane.
     2. Many short OVERLAPPING calls — a greedy lane assignment would squeeze a
        30-min call into a thin sliver next to a 7h day-support block. So after
        assigning lanes, each call WIDENS RIGHTWARD into empty lanes until it
        meets a call it truly overlaps in time.
   ========================================================================== */

const H0 = 6;                        // first hour shown — the reference's H0
// The reference's H1 is 20 (its sample data ends by 19:00). Real visits run
// later — the CO CHC evening call is 20:00-22:00 — so H1 is 22 here: a
// deliberate, documented deviation to avoid silently clipping real shifts off
// the bottom of the grid, not an oversight.
const H1 = 22;
const HOUR_PX = 54;                  // vertical pixels per hour — the reference's HH
// Inset above the first hour and below the last. Without it the 06:00 label
// (drawn 4px above its own line, to sit centred on it) overlapped the live-in
// band, and 22:00 hung past the bottom edge.
const GRID_PAD = 10;
const GRID_PX = (H1 - H0) * HOUR_PX;
const GRID_BOX = GRID_PX + GRID_PAD * 2;      // the drawn height of a day column
const yFor = (min) => (min / 60 - H0) * HOUR_PX + GRID_PAD;  // minutes-into-day -> pixels
// A visit card is at least as tall as its CONTENT: the header row, the time,
// and one line per carer — however many that is. A 30-minute double-up is 25px
// by the clock but needs ~65px to name both carers, so it gets 65. Values are
// real px (text is scaled by s(), these already account for it).
const CARD_HEAD = 16;   // client + marks + n/req
const CARD_TIME = 13;   // the time range line
const CARD_NAME = 14;   // one carer
const CARD_PAD = 9;     // padding + inter-line gaps
function cardHeight(v, startMin, endMin) {
  const byClock = ((endMin - startMin) / 60) * HOUR_PX - 2;
  const carers = (v.assignments ?? []).length;
  const byContent = carers ? CARD_HEAD + CARD_TIME + carers * CARD_NAME + CARD_PAD : 0;
  return Math.max(20, byClock, byContent);
}

const GRID_HOURS = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);
const GRID_COLS = '52px repeat(7, minmax(0, 1fr))';
const RUN_COLS = '104px repeat(7, minmax(0, 1fr))';

// The runs the office already works to, in the order the day reads. `run` is a
// computed field on the visit (UK start time + duration), not a stored one.
const RUN_ORDER = ['Live-in', 'Morning call', 'Day support', 'Lunch call', 'Tea call', 'Bed call', 'Other calls'];
const runOf = (v) => v.run || 'Other calls';

// "Dorothy Burgin" -> "D. Burgin". Initials alone are ambiguous here: this
// provider has two clients at one address whose initials both read "DB"/"JB".
const shortName = (p) => {
  const first = p?.first_name?.trim();
  const last = p?.last_name?.trim();
  if (!first && !last) return 'Unknown';
  if (!last) return first;
  return `${first ? `${first[0]}. ` : ''}${last}`;
};
const inits = (p) => ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')) || '—';
const isShort = (v) => v.status !== 'cancelled' && (v.assignments ?? []).length < (v.staff_required ?? 1);
// A visit is editable unless it's cancelled — its record stands. Past and
// already-started visits can be retimed too (admin reconciliation); every edit
// is audited (who, before/after, reason) by the backend.
const isEditable = (v) => v.status !== 'cancelled';
// A cancelled visit reads its state from the visit status, not the assignment
// (its carer was withdrawn, so there's no active assignment to read from).
const stateOf = (v) => (v.status === 'cancelled' ? 'cancelled' : (v.assignments?.[0]?.lifecycle_state) ?? 'scheduled');

// Minutes-into-the-UK-day for an instant (0..1440), from UK wall-clock parts so
// the axis is right whatever zone the admin's browser is in.
function ukMinutes(iso) {
  const [h, m] = new Date(iso)
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' })
    .split(':').map(Number);
  return h * 60 + m;
}
// A live-in / 24h shift: ends on a later UK day than it starts. Pulled OUT of
// the timeline into the band above it.
const isLiveIn = (v) => ukDay(v.scheduled_end) !== ukDay(v.scheduled_start);
const durMin = (v) => Math.round((new Date(v.scheduled_end) - new Date(v.scheduled_start)) / 60000);
const durHrs = (v) => durMin(v) / 60;
// Two hour formats, matching the reference: a single visit's length keeps two
// decimals so a 45-minute call reads exactly (0.75h), while week/day totals
// round to one (446.6h, not 446.58h).
const hoursLabel = (h) => `${Math.round(h * 100) / 100}h`;
const hoursTotal = (h) => `${Math.round(h * 10) / 10}h`;
// A live-in is a whole night on the rota; its 07:00->06:59 window is 23.98h,
// which reads as noise. Call it what the office calls it.
const visitLength = (v) => (isLiveIn(v) ? '24h' : hoursLabel(durHrs(v)));
// Run `fn` over `items` with at most `lanes` in flight. Each cover broadcast is
// a ~1.5s, 100-query request server-side: firing one per visit at once saturates
// the thread pool and every other request in the console queues behind it. Pace
// them instead. Returns { ok, failed, results } and never rejects.
async function runPaced(items, fn, lanes = 4, onProgress) {
  const queue = [...items];
  const results = [];
  let ok = 0, failed = 0;
  const lane = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      try { results.push(await fn(item)); ok += 1; }
      catch { failed += 1; }
      onProgress?.();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(lanes, items.length)) }, lane));
  return { ok, failed, results };
}
const ADVERTISE_LANES = 4;

const minToHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// n / req and the derived status, mirroring the reference's statusOf.
function shiftStatus(v) {
  if (v.status === 'cancelled') return 'cancelled';
  const n = (v.assignments ?? []).length;
  const req = v.staff_required ?? 1;
  if (n === 0) return 'unfilled';
  if (n < req) return 'partial';
  return stateOf(v) === 'completed' ? 'completed' : 'filled';
}

// Every carer double-booked on `v` — the same person on another visit that
// overlaps this one in time. The assign flow hard-blocks new double-bookings,
// so a flag here means historic or imported data, not something the office can
// create today. Compared on absolute timestamps, never minute-of-day, so an
// overnight visit can't hide a real clash.
function conflictsOn(v, all) {
  if (v.status === 'cancelled') return [];
  const mine = (v.assignments ?? []).map((a) => a.employee).filter(Boolean);
  if (!mine.length) return [];
  const start = new Date(v.scheduled_start).getTime();
  const end = new Date(v.scheduled_end).getTime();
  return mine.filter((emp) => all.some((o) => o.id !== v.id
    && o.status !== 'cancelled'
    && new Date(o.scheduled_start).getTime() < end
    && start < new Date(o.scheduled_end).getTime()
    && (o.assignments ?? []).some((a) => a.employee?.id === emp.id)));
}

// Carers with nothing overlapping this visit — the reference's available().
// Active, not already on the visit, and free across the whole window.
function freeCarers(v, employees, all, limit = 3) {
  const start = new Date(v.scheduled_start).getTime();
  const end = new Date(v.scheduled_end).getTime();
  const already = new Set((v.assignments ?? []).map((a) => a.employee?.id));
  return employees.filter((e) => e.active && !already.has(e.id)).filter((e) => !all.some((o) => o.status !== 'cancelled'
    && new Date(o.scheduled_start).getTime() < end
    && start < new Date(o.scheduled_end).getTime()
    && (o.assignments ?? []).some((a) => a.employee?.id === e.id))).slice(0, limit);
}

// Coverage for one day's visits, the reference's dayStats: how many carer-slots
// are required vs filled, how many gaps remain, and the care-hours left
// uncovered. Cancelled visits don't count towards or against coverage.
function dayStats(list) {
  const live = list.filter((v) => v.status !== 'cancelled');
  let req = 0, fil = 0, unf = 0, hrs = 0;
  for (const v of live) {
    const r = v.staff_required ?? 1;
    const n = (v.assignments ?? []).length;
    req += r; fil += Math.min(n, r);
    if (n < r) { unf += r - n; hrs += durHrs(v) * (r - n); }
  }
  return { req, fil, unf, hrs, n: live.length };
}

// Lay out a day's NON-live visits into lanes, then widen each rightward so short
// calls fill the width instead of being squeezed next to a long day-support
// block. Returns [{ v, startMin, endMin, lane, lanes, span }].
function layoutDay(visits, dayISO) {
  const items = visits
    .filter((v) => !isLiveIn(v) && ukDay(v.scheduled_start) === dayISO)
    .map((v) => ({ v, startMin: ukMinutes(v.scheduled_start), endMin: ukMinutes(v.scheduled_end) }))
    // Reserve the height the card will actually be drawn at, not just its clock
    // duration — otherwise a card that grew to fit its carers gets overlapped by
    // the next call along.
    .map((it) => ({
      ...it,
      endEff: it.startMin + Math.max(25, (cardHeight(it.v, it.startMin, it.endMin) / HOUR_PX) * 60),
    }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const laneEnds = [];
  for (const it of items) {
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endEff); }
    else laneEnds[lane] = it.endEff;
    it.lane = lane;
  }
  const lanes = Math.max(1, laneEnds.length);
  for (const it of items) {
    it.lanes = lanes;
    let span = 1;
    for (let L = it.lane + 1; L < lanes; L++) {
      const blocked = items.some((o) => o !== it && o.lane === L && it.startMin < o.endEff && o.startMin < it.endEff);
      if (blocked) break;
      span++;
    }
    it.span = span;
  }
  return items;
}

/* ------------------------------- appearance ------------------------------- */

// Status -> the card's left-border colour + tinted background, mirroring the
// reference's s-<status> classes, on our own themed tokens so the rota reads in
// light and dark alike.
const STATUS_STYLE = {
  unfilled: { bar: 'var(--d-unfilled-ink)', bg: 'var(--d-unfilled-bg)' },
  partial: { bar: 'var(--d-unfilled-ink)', bg: 'var(--d-unfilled-bg)' },
  filled: { bar: 'var(--d-primary)', bg: 'color-mix(in srgb, var(--d-primary) 16%, var(--d-card))' },
  completed: { bar: 'var(--d-ok-ink)', bg: 'var(--d-ok-bg)' },
  cancelled: { bar: 'var(--d-faint)', bg: 'var(--d-panel)' },
};
const STATUS_CHIPS = [
  ['unfilled', 'Unfilled'], ['partial', 'Part-filled'], ['filled', 'Filled'],
  ['completed', 'Completed'], ['cancelled', 'Cancelled'],
];
const styleFor = (st) => STATUS_STYLE[st] ?? STATUS_STYLE.filled;

const selectStyle = { ...s('height:32px;border-radius:9px;border:1px solid var(--d-border);background:var(--d-field);padding:0 10px;font-size:12px;font-weight:600;color:var(--d-ink);outline:none'), fontFamily: 'inherit' };
const fieldStyle = { ...s('height:40px;border-radius:11px;border:1px solid var(--d-border);background:var(--d-field);padding:0 12px;font-size:13px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };
const pillStyle = { ...s('border:1px solid var(--d-border);border-radius:99px;padding:4px 10px;font-size:11.5px;font-weight:600;background:var(--d-panel);color:var(--d-ink);cursor:pointer'), fontFamily: 'inherit' };
const sectionTitle = s('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--d-muted);margin-bottom:8px');

/* ---------- confirm / reason dialog (replaces window.prompt/confirm) ---------- */
// dialog = { title, body, confirmLabel, danger, needReason, reasonLabel, onConfirm(reason) }
function ConfirmDialog({ dialog, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!dialog) return null;
  const submit = async () => {
    if (dialog.needReason && !reason.trim()) return;
    setBusy(true);
    try { await dialog.onConfirm(reason.trim()); onClose(); }
    finally { setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:440px;background:var(--d-card);border-radius:22px;padding:22px 24px;display:flex;flex-direction:column;gap:14px')}>
        <div style={s('font-size:17px;font-weight:700;color:var(--d-ink);letter-spacing:-0.2px')}>{dialog.title}</div>
        {dialog.body && <div style={s('font-size:13px;font-weight:500;color:var(--d-ink2);line-height:1.5')}>{dialog.body}</div>}
        {dialog.needReason && (
          <div style={s('display:flex;flex-direction:column;gap:6px')}>
            <span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>{dialog.reasonLabel || 'Reason'} <span style={s('color:var(--d-danger-ink)')}>*</span></span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Kept in the audit trail with your name and time"
              style={{ ...fieldStyle, ...s('height:auto;padding:10px 12px;resize:vertical') }} />
          </div>
        )}
        <div style={s('display:flex;justify-content:flex-end;gap:8px;margin-top:2px')}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={dialog.danger ? 'danger' : 'primary'} icon="check" onClick={busy || (dialog.needReason && !reason.trim()) ? undefined : submit}>{busy ? 'Working…' : dialog.confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- cards ---------------------------------- */

// One timed shift card, absolutely positioned by time and lane. Content mirrors
// the reference's card: client code, ↻ (recurring) / ! (conflict) marks, the
// n/req count, the time, and the carer line — coloured by status via a left
// border, with a diagonal hatch when part-filled. Compact (duration < 40 min,
// matching the reference) drops the time/who lines to fit.
function ShiftCard({ item, selected, conflicted, onOpen, onToggleSelect }) {
  const { v, startMin, endMin, lane, lanes, span } = item;
  const status = shiftStatus(v);
  const st = styleFor(status);
  const assigned = v.assignments ?? [];
  const req = v.staff_required ?? 1;
  const cancelled = status === 'cancelled';
  // Staffing is not spelled out in words: the n/req badge already carries it.
  const carerNames = assigned.map((a) => fullName(a.employee));
  const height = cardHeight(v, startMin, endMin);
  // The time line is the first thing to go on a card too short to hold it; the
  // carers never are — the card grew to fit them.
  const showTime = height >= 35;

  return (
    <div
      data-visit-block className="pressable"
      title={`${fullName(v.service_user)} · ${formatTime(v.scheduled_start)}–${formatTime(v.scheduled_end)} · ${runOf(v)} · ${assigned.length}/${req}`}
      onClick={(e) => {
        e.stopPropagation();
        // Cmd/Ctrl/Shift-click toggles multi-select for the bulk bar; a plain
        // click opens the visit drawer. Straight from the reference's cardEl.
        if (e.metaKey || e.ctrlKey || e.shiftKey) { onToggleSelect(v.id); return; }
        onOpen(v);
      }}
      style={{
        ...s('position:absolute;overflow:hidden;cursor:pointer;padding:3px 6px;box-sizing:border-box;border-radius:5px;display:flex;flex-direction:column;gap:1px'),
        top: yFor(startMin),
        height,
        left: `calc(${(100 / lanes) * lane}% + 2px)`,
        width: `calc(${(100 / lanes) * span}% - 4px)`,
        background: st.bg, color: 'var(--d-ink)', borderLeft: `3px solid ${st.bar}`,
        opacity: cancelled ? 0.7 : 1, textDecoration: cancelled ? 'line-through' : 'none',
        boxShadow: selected ? '0 0 0 2px var(--d-primary)' : '0 1px 2px rgba(15,23,32,0.10)',
        zIndex: selected ? 3 : 1,
        backgroundImage: status === 'partial' ? 'repeating-linear-gradient(135deg,transparent 0 6px,rgba(168,64,26,0.14) 6px 12px)' : undefined,
      }}>
      <span style={s('display:flex;align-items:center;gap:4px;min-width:0')}>
        <span style={s('flex:none;font-size:11px;font-weight:800;letter-spacing:0.02em;line-height:1.2')}>{inits(v.service_user)}</span>
        {v.care_package_slot_id && <span title="Repeats every week" style={s('flex:none;font-size:9px;opacity:0.6')}>↻</span>}
        {conflicted && <span title="This carer has another overlapping visit" style={s('flex:none;font-size:10px;font-weight:800;color:var(--d-unfilled-ink)')}>!</span>}
        <span style={s('flex:1;min-width:0')} />
        <span className="d-num" style={s('flex:none;font-size:9.5px;font-weight:700;opacity:0.85')}>{assigned.length}/{req}</span>
      </span>
      {showTime && (
        <span className="d-num" style={s('font-size:9.5px;font-weight:600;opacity:0.8;white-space:nowrap')}>{formatTime(v.scheduled_start)}–{formatTime(v.scheduled_end)}</span>
      )}
      {/* Every carer, one per line. The card was sized to hold them all. */}
      {carerNames.map((n) => (
        <span key={n} style={s('font-size:10px;font-weight:600;color:var(--d-ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2')}>{n}</span>
      ))}
      {cancelled && <span style={{ ...s('font-size:10px;font-weight:600;line-height:1.2'), color: st.bar }}>Cancelled</span>}
    </div>
  );
}

// The band above the grid for LIVE-IN (24h) shifts — one cell per day, a compact
// chip per live-in, so they never eat a lane in the timeline below.
function LiveInChip({ v, selected, conflicted, onOpen, onToggleSelect }) {
  const st = styleFor(shiftStatus(v));
  const assigned = v.assignments ?? [];
  return (
    <div data-visit-block className="pressable"
      title={`${fullName(v.service_user)} · live-in 24h`}
      onClick={(e) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey || e.shiftKey) { onToggleSelect(v.id); return; }
        onOpen(v);
      }}
      style={{
        ...s('position:relative;display:flex;align-items:center;gap:4px;border-radius:5px;padding:2px 6px;cursor:pointer;min-width:0'),
        background: st.bg, borderLeft: `3px solid ${st.bar}`, boxShadow: selected ? '0 0 0 2px var(--d-primary)' : 'none',
      }}>
      <span style={s('flex:none;font-size:9px;opacity:0.7')}>☾</span>
      <span style={s('flex:none;font-size:10px;font-weight:800;letter-spacing:0.02em')}>{inits(v.service_user)}</span>
      {v.care_package_slot_id && <span title="Repeats every week" style={s('flex:none;font-size:9px;opacity:0.6')}>↻</span>}
      {conflicted && <span title="This carer has another overlapping visit" style={s('flex:none;font-size:10px;font-weight:800;color:var(--d-unfilled-ink)')}>!</span>}
      <span style={s('flex:1;min-width:0')} />
      <span style={{ ...s('flex:none;font-size:9.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), color: assigned.length ? 'var(--d-ink2)' : st.bar }}>
        {assigned.length ? fullName(assigned[0].employee) : 'Unfilled'}
      </span>
    </div>
  );
}

/* -------------------------------- week grid -------------------------------- */

function TimeRuler() {
  return (
    <div style={{ ...s('position:relative;background:var(--d-panel);border-right:1px solid var(--d-border)'), height: GRID_BOX }}>
      {GRID_HOURS.map((h) => (
        <div key={h} className="d-num" style={{ ...s('position:absolute;right:6px;font-size:9.5px;font-weight:600;color:var(--d-muted);line-height:1'), top: yFor(h * 60) - 4 }}>
          {`${String(h).padStart(2, '0')}:00`}
        </div>
      ))}
    </div>
  );
}

// One day's timeline: hour + half-hour lines, a now-line on today, its non-live
// shifts laid out with widen-rightward lanes, and click-empty-space to add.
function DayColumn({ dayISO, visits, allVisits, selected, flagConflicts, today, weekend, onOpen, onToggleSelect, onAdd, canAdd }) {
  const items = layoutDay(visits, dayISO);
  const nowMin = ukMinutes(new Date().toISOString());
  return (
    <div style={{
      ...s('position:relative;border-left:1px solid var(--d-border)'), height: GRID_BOX,
      background: weekend ? 'var(--d-panel)' : 'transparent',
      boxShadow: today ? 'inset 0 0 0 1px var(--d-primary-soft)' : 'none',
    }}
      onClick={canAdd ? (e) => {
        if (e.target.closest('[data-visit-block]')) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top - GRID_PAD;
        const raw = H0 * 60 + Math.round(((offsetY / GRID_PX) * (H1 - H0) * 60) / 15) * 15;
        onAdd(Math.max(0, Math.min(1439, raw)));
      } : undefined}>
      {GRID_HOURS.map((h) => (
        <div key={h}>
          <div style={{ ...s('position:absolute;left:0;right:0;border-top:1px solid var(--d-border);opacity:0.6'), top: yFor(h * 60) }} />
          {h < H1 && <div style={{ ...s('position:absolute;left:0;right:0;border-top:1px dotted var(--d-border);opacity:0.4'), top: yFor(h * 60 + 30) }} />}
        </div>
      ))}
      {today && nowMin >= H0 * 60 && nowMin <= H1 * 60 && (
        <div style={{ ...s('position:absolute;left:0;right:0;border-top:2px solid var(--d-unfilled-ink);z-index:4'), top: yFor(nowMin) }} />
      )}
      {items.map((it) => (
        <ShiftCard key={it.v.id} item={it} selected={selected.includes(it.v.id)}
          conflicted={flagConflicts && conflictsOn(it.v, allVisits).length > 0}
          onOpen={onOpen} onToggleSelect={onToggleSelect} />
      ))}
    </div>
  );
}

/* -------------------------------- week: runs ------------------------------- */

/* One call, as one readable line: when, who it's for, and whether it's covered.
   Sized by its content, never by its duration — a 30-minute call carries the
   same information as a two-hour one and deserves the same room to say it. */
function RunChip({ v, selected, conflicted, onOpen, onToggleSelect }) {
  const status = shiftStatus(v);
  const st = styleFor(status);
  const assigned = v.assignments ?? [];
  const req = v.staff_required ?? 1;
  const covered = assigned.length >= req && status !== 'cancelled';
  return (
    <div data-visit-block className="hv"
      title={`${fullName(v.service_user)} · ${isLiveIn(v) ? 'live-in 24h' : `${formatTime(v.scheduled_start)}–${formatTime(v.scheduled_end)}`} · ${runOf(v)} · ${assigned.length}/${req}${assigned.length ? ` · ${assigned.map((a) => fullName(a.employee)).join(', ')}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey || e.shiftKey) { onToggleSelect(v.id); return; }
        onOpen(v);
      }}
      style={{
        ...s('display:flex;align-items:center;gap:6px;padding:3px 7px 3px 6px;border-radius:4px;cursor:pointer;min-width:0'),
        // Quiet by default. When 144 of 182 visits are unfilled, tinting them all
        // just makes an orange wall — so the fill stays neutral and the left edge
        // carries the state.
        background: selected ? 'var(--d-primary-soft)' : 'var(--d-panel)',
        borderLeft: `3px solid ${st.bar}`,
        boxShadow: selected ? 'inset 0 0 0 1px var(--d-primary)' : 'none',
        opacity: status === 'cancelled' ? 0.55 : 1,
        '--hbg': 'var(--d-card-hover)',
      }}>
      <span className="d-num" style={s('flex:none;font-size:10px;font-weight:600;color:var(--d-muted);letter-spacing:-0.2px')}>
        {isLiveIn(v) ? '24h' : formatTime(v.scheduled_start)}
      </span>
      <span style={{
        ...s('flex:1;min-width:0;font-size:11px;font-weight:600;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
        textDecoration: status === 'cancelled' ? 'line-through' : 'none',
      }}>{shortName(v.service_user)}</span>
      {conflicted && <span title="This carer has another overlapping visit" style={s('flex:none;font-size:10px;font-weight:800;color:var(--d-unfilled-ink)')}>!</span>}
      {/* The count only speaks up when it needs something. A covered call shows a
          tick, so the eye skips it and lands on the gaps. */}
      {covered
        ? <span style={s('flex:none;color:var(--d-ok-ink);display:flex')}><Icon name="check" size={11} /></span>
        : <span className="d-num" style={{ ...s('flex:none;font-size:10px;font-weight:800;padding:0 4px;border-radius:3px'), background: 'var(--d-unfilled-bg)', color: 'var(--d-unfilled-ink)' }}>{assigned.length}/{req}</span>}
    </div>
  );
}

/* The week as the office actually works it: seven days across, the care runs
   down. Every row is a run the provider recognises — the morning call, the
   lunch call — and every cell holds that run's calls for that day.

   This deliberately replaces a clock-proportional timeline. With 70% of visits
   running 30-45 minutes, a time axis spends most of its height on the gaps
   BETWEEN calls and squeezes the calls themselves to ~25px. Here every pixel is
   a visit. Switch to Hours (the timeline) when you need to see real overlap. */
function WeekRuns({ days, visits, allVisits, selected, flagConflicts, onOpen, onToggleSelect, onAdd, canAdd }) {
  const rows = RUN_ORDER.filter((r) => visits.some((v) => runOf(v) === r));
  if (!rows.length) {
    return <div style={s('padding:44px;text-align:center;font-size:13px;font-weight:600;color:var(--d-muted)')}>No visits match these filters.</div>;
  }
  return (
    <div style={{ ...s('display:grid'), gridTemplateColumns: RUN_COLS }}>
      {rows.map((run) => (
        <div key={run} style={s('display:contents')}>
          <div style={s('position:sticky;left:0;z-index:2;background:var(--d-panel);border-right:1px solid var(--d-border);border-top:1px solid var(--d-border);padding:8px 10px;display:flex;flex-direction:column;gap:2px')}>
            <span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink);line-height:1.2')}>{run}</span>
            <span className="d-num" style={s('font-size:10px;font-weight:600;color:var(--d-muted)')}>
              {visits.filter((v) => runOf(v) === run).length}
            </span>
          </div>
          {days.map((d) => {
            const cell = visits
              .filter((v) => runOf(v) === run && ukDay(v.scheduled_start) === d.iso)
              .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
            return (
              <div key={d.iso}
                onClick={canAdd ? (e) => { if (!e.target.closest('[data-visit-block]')) onAdd(d.iso); } : undefined}
                style={{
                  ...s('border-left:1px solid var(--d-border);border-top:1px solid var(--d-border);padding:5px;display:flex;flex-direction:column;gap:3px;min-height:38px'),
                  background: d.today ? 'var(--d-primary-soft)' : (d.date.getDay() === 0 || d.date.getDay() === 6) ? 'var(--d-panel2)' : 'transparent',
                  cursor: canAdd ? 'copy' : 'default',
                }}>
                {cell.map((v) => (
                  <RunChip key={v.id} v={v} selected={selected.includes(v.id)}
                    conflicted={flagConflicts && conflictsOn(v, allVisits).length > 0}
                    onOpen={onOpen} onToggleSelect={onToggleSelect} />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ coverage strip ----------------------------- */

// The reference's coverstrip: one button per day with "n/req filled", the gap
// count, and a two-colour meter. Clicking a day opens that day's view. Shares
// the grid's column template so it stays aligned with the timeline below.
function CoverStrip({ days, visits, onPickDay, cols = GRID_COLS }) {
  return (
    <div style={{ ...s('display:grid;position:sticky;top:0;z-index:6;background:var(--d-panel);border-bottom:1px solid var(--d-border);border-radius:15px 15px 0 0;overflow:hidden'), gridTemplateColumns: cols }}>
      <div style={s('border-right:1px solid var(--d-border)')} />
      {days.map((d) => {
        const cs = dayStats(visits.filter((v) => ukDay(v.scheduled_start) === d.iso));
        const pct = cs.req ? Math.round((cs.fil / cs.req) * 100) : 100;
        return (
          <button key={d.iso} type="button" onClick={() => onPickDay(d.date)}
            style={{ ...s('text-align:left;padding:7px 9px 8px;border:0;border-left:1px solid var(--d-border);cursor:pointer;display:flex;flex-direction:column;gap:5px'), background: d.today ? 'var(--d-primary-soft)' : 'transparent', fontFamily: 'inherit' }}>
            <span style={s('display:flex;align-items:baseline;gap:6px')}>
              <span style={{ ...s('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em'), color: d.today ? 'var(--d-primary-deep)' : 'var(--d-muted)' }}>{d.label}</span>
              <span className="d-num" style={{ ...s('font-size:12px;font-weight:700'), color: d.today ? 'var(--d-primary-deep)' : 'var(--d-ink)' }}>{d.num}</span>
            </span>
            <span className="d-num" style={s('display:flex;gap:7px;font-size:9.5px;font-weight:600;color:var(--d-muted)')}>
              <span>{cs.fil}/{cs.req} filled</span>
              {cs.unf > 0 && <span style={s('color:var(--d-unfilled-ink)')}>{cs.unf} gap{cs.unf > 1 ? 's' : ''}</span>}
            </span>
            <span style={s('height:4px;border-radius:2px;background:var(--d-track);overflow:hidden;display:flex')}>
              <span style={{ height: '100%', width: `${pct}%`, background: 'var(--d-ok-ink)', display: 'block' }} />
              <span style={{ height: '100%', width: `${100 - pct}%`, background: 'var(--d-unfilled-ink)', display: 'block' }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------- day / queue / staff panes ------------------------ */

const paneStyle = s('padding:16px 18px 40px;display:flex;flex-direction:column;gap:4px');
const rowStyle = s('display:grid;grid-template-columns:96px minmax(150px,1.1fr) minmax(160px,1.4fr) auto;gap:12px;align-items:center;padding:9px 12px;border:1px solid var(--d-border);border-radius:10px;background:var(--d-card);margin-bottom:6px');

function PaneHead({ title, sub }) {
  return (
    <div style={s('margin-bottom:10px')}>
      <div style={s('font-size:15px;font-weight:700;color:var(--d-ink);letter-spacing:-0.1px')}>{title}</div>
      {sub && <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{sub}</div>}
    </div>
  );
}

// Day view — the reference's grouped list, not a timeline: the day's shifts
// under their run heading, each row time + client + who + count.
function DayPane({ date, visits, allVisits, flagConflicts, onOpen }) {
  const iso = isoDate(date);
  const list = visits.filter((v) => ukDay(v.scheduled_start) === iso);
  const cs = dayStats(list);
  const byRun = {};
  for (const v of list) (byRun[runOf(v)] = byRun[runOf(v)] || []).push(v);
  return (
    <div style={paneStyle}>
      <PaneHead
        title={date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        sub={`${cs.n} visit${cs.n === 1 ? '' : 's'} · ${cs.fil} of ${cs.req} slots covered · ${cs.unf} gap${cs.unf === 1 ? '' : 's'} (${hoursTotal(cs.hrs)})`} />
      {list.length === 0 && <div style={s('font-size:13px;font-weight:600;color:var(--d-muted);padding:24px 0')}>Nothing on the rota for this day.</div>}
      {RUN_ORDER.filter((r) => byRun[r]).map((r) => (
        <div key={r} style={s('margin-bottom:14px')}>
          <div style={sectionTitle}>{r}</div>
          {byRun[r].sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start)).map((v) => {
            const st = shiftStatus(v);
            const assigned = v.assignments ?? [];
            const clash = flagConflicts ? conflictsOn(v, allVisits) : [];
            return (
              <div key={v.id} onClick={() => onOpen(v)} className="hv"
                style={{ ...rowStyle, borderLeft: `3px solid ${styleFor(st).bar}`, cursor: 'pointer', '--hbg': 'var(--d-card-hover)' }}>
                <div className="d-num" style={s('font-size:12px;font-weight:700;color:var(--d-ink)')}>
                  {isLiveIn(v) ? 'Live-in' : `${formatTime(v.scheduled_start)}–${formatTime(v.scheduled_end)}`}
                  <div style={s('font-size:10px;font-weight:500;color:var(--d-muted)')}>{visitLength(v)}</div>
                </div>
                <div>
                  <div style={{ ...s('font-size:13px;font-weight:700;color:var(--d-ink)'), textDecoration: st === 'cancelled' ? 'line-through' : 'none' }}>{fullName(v.service_user)}</div>
                  <div style={s('font-size:11px;font-weight:500;color:var(--d-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{addressOf(v.service_user)}</div>
                </div>
                <div>
                  <div style={{ ...s('font-size:12.5px;font-weight:600'), color: assigned.length ? 'var(--d-ink2)' : 'var(--d-unfilled-ink)' }}>
                    {st === 'cancelled' ? 'Cancelled' : assigned.length ? assigned.map((a) => fullName(a.employee)).join(' · ') : '— unassigned —'}
                  </div>
                  {clash.length > 0 && <div style={s('margin-top:4px')}><Tag tone="danger">Double-booked: {clash.map((c) => fullName(c)).join(', ')}</Tag></div>}
                </div>
                <div style={s('display:flex;align-items:center;gap:8px;justify-content:flex-end')}>
                  <span className="d-num" style={s('font-size:11px;font-weight:700;color:var(--d-muted)')}>{assigned.length}/{v.staff_required ?? 1}</span>
                  <span style={pillStyle}>Open</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Unfilled queue — every gap in the week, soonest first, each with up to three
// carers who are actually free at that time and a one-click advertise.
function QueuePane({ days, visits, allVisits, employees, canManage, onOpen, onAssign, onAdvertise }) {
  const gaps = visits.filter((v) => ['unfilled', 'partial'].includes(shiftStatus(v)));
  const hrs = gaps.reduce((a, v) => a + durHrs(v) * ((v.staff_required ?? 1) - (v.assignments ?? []).length), 0);
  return (
    <div style={paneStyle}>
      <PaneHead title="Unfilled queue"
        sub={`${gaps.length} visit${gaps.length === 1 ? '' : 's'} need cover — ${hoursTotal(hrs)}. Soonest first; suggestions exclude anyone already booked at that time.`} />
      {gaps.length === 0 && <div style={s('font-size:13px;font-weight:600;color:var(--d-ok-ink);padding:24px 0')}>Every visit in view is covered.</div>}
      {days.map((d) => {
        const list = gaps.filter((v) => ukDay(v.scheduled_start) === d.iso)
          .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
        if (!list.length) return null;
        return (
          <div key={d.iso} style={s('margin-bottom:14px')}>
            <div style={sectionTitle}>{d.label} {d.num} — {list.length} to fill</div>
            {list.map((v) => {
              const free = freeCarers(v, employees, allVisits, 3);
              return (
                <div key={v.id} style={{ ...rowStyle, borderLeft: '3px solid var(--d-unfilled-ink)' }}>
                  <div className="d-num" style={s('font-size:12px;font-weight:700;color:var(--d-ink)')}>
                    {isLiveIn(v) ? 'Live-in' : `${formatTime(v.scheduled_start)}–${formatTime(v.scheduled_end)}`}
                    <div style={s('font-size:10px;font-weight:500;color:var(--d-muted)')}>{runOf(v)}</div>
                  </div>
                  <div>
                    <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{fullName(v.service_user)}</div>
                    <div style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>{(v.assignments ?? []).length}/{v.staff_required ?? 1} carers · {visitLength(v)}</div>
                  </div>
                  <div style={s('display:flex;flex-wrap:wrap;gap:5px;align-items:center')}>
                    <span style={s('font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--d-muted)')}>Free now</span>
                    {free.length === 0
                      ? <span style={{ ...pillStyle, ...s('border-style:dashed;background:transparent;color:var(--d-muted);cursor:default') }}>no one free</span>
                      : free.map((e) => (
                        <button key={e.id} type="button" disabled={!canManage} onClick={() => onAssign(v, e)}
                          style={{ ...pillStyle, opacity: canManage ? 1 : 0.5, cursor: canManage ? 'pointer' : 'not-allowed' }}>{e.full_name}</button>
                      ))}
                  </div>
                  <div style={s('display:flex;align-items:center;gap:6px;justify-content:flex-end')}>
                    <button type="button" style={pillStyle} onClick={() => onOpen(v)}>Open</button>
                    {canManage && <button type="button" style={pillStyle} onClick={() => onAdvertise(v)}>Advertise</button>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Staff view — the week's load per carer: hours against contract, live-in
// nights, and one column per day. Red marks a clash.
function StaffPane({ days, employees, visits, allVisits, flagConflicts, onOpen }) {
  const mineOf = (e) => visits.filter((v) => v.status !== 'cancelled' && (v.assignments ?? []).some((a) => a.employee?.id === e.id));
  const th = s('text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--d-muted);padding:9px 8px;border-bottom:1px solid var(--d-border);background:var(--d-panel);white-space:nowrap');
  const td = s('padding:7px 8px;border-bottom:1px solid var(--d-border);vertical-align:top');
  return (
    <div style={paneStyle}>
      <PaneHead title="Care worker load"
        sub="Hours exclude live-in nights, which are counted separately. Red marks a clash — the same carer on two overlapping visits." />
      <div style={s('overflow-x:auto')}>
        <table style={{ ...s('width:100%;border-collapse:collapse;background:var(--d-card);border:1px solid var(--d-border);border-radius:10px;overflow:hidden'), minWidth: 900 }}>
          <thead>
            <tr>
              {['Care worker', 'Hours', 'Live-in'].concat(days.map((d) => `${d.label} ${d.num}`)).map((h) => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const mine = mineOf(e);
              const hrs = mine.filter((v) => !isLiveIn(v)).reduce((a, v) => a + durHrs(v), 0);
              const nights = mine.filter(isLiveIn).length;
              const contract = e.contracted_hours_per_week;
              const pct = contract ? Math.min(100, (hrs / contract) * 100) : (hrs ? 100 : 0);
              return (
                <tr key={e.id}>
                  <td style={td}>
                    <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);white-space:nowrap')}>{e.full_name}</div>
                    <div className="d-num" style={s('font-size:10px;font-weight:500;color:var(--d-muted)')}>{contract ? `${contract}h contract` : 'bank / no contract'}</div>
                  </td>
                  <td style={td}>
                    <div className="d-num" style={s('font-size:12px;font-weight:700;color:var(--d-ink)')}>{hoursTotal(hrs)}</div>
                    <div style={{ ...s('height:5px;border-radius:3px;background:var(--d-track);overflow:hidden;margin-top:5px'), width: 96 }}>
                      <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: contract && hrs > contract ? 'var(--d-unfilled-ink)' : 'var(--d-ok-ink)' }} />
                    </div>
                  </td>
                  <td style={{ ...td, ...s('font-size:12px;font-weight:600;color:var(--d-ink2);white-space:nowrap') }}>{nights ? `${nights} ☾` : '—'}</td>
                  {days.map((d) => {
                    const cells = mine.filter((v) => ukDay(v.scheduled_start) === d.iso)
                      .sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start));
                    return (
                      <td key={d.iso} style={td}>
                        {cells.length === 0 ? <span style={s('font-size:11px;color:var(--d-faint)')}>—</span> : cells.map((v) => {
                          const clash = flagConflicts && conflictsOn(v, allVisits).some((c) => c.id === e.id);
                          return (
                            <div key={v.id} onClick={() => onOpen(v)} className="d-num"
                              style={{
                                ...s('border-radius:4px;padding:2px 5px;font-size:10px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer'),
                                borderLeft: `2px solid ${clash ? 'var(--d-unfilled-ink)' : 'var(--d-primary)'}`,
                                background: clash ? 'var(--d-unfilled-bg)' : 'var(--d-panel)',
                                color: clash ? 'var(--d-unfilled-ink)' : 'var(--d-ink2)',
                              }}>
                              {isLiveIn(v) ? '24h' : formatTime(v.scheduled_start)} {inits(v.service_user)}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- drawer --------------------------------- */

const EVENT_LABEL = {
  'visit.rescheduled': 'Visit retimed',
  'visit.cancelled': 'Visit cancelled',
  'visit.deleted': 'Visit deleted',
  'assignment.created': 'Carer assigned',
  'assignment.reassigned': 'Carer reassigned',
  'assignment.withdrawn': 'Carer removed',
  'cover.broadcast': 'Advertised for cover',
  'cover.offered': 'Offered to a carer',
  'cover.accepted': 'Cover accepted',
  'cover.declined': 'Cover declined',
};
function eventDetail(e) {
  const p = e.payload ?? {};
  if (p.employee_name) return p.employee_name;
  if (p.offer_count != null) return `${p.offer_count} carer${p.offer_count === 1 ? '' : 's'} offered`;
  if (p.reason) return p.reason;
  return '';
}

// What the carer actually recorded on this visit — the care plan tasks ticked
// off and the notes written. Read-only; mirrors what the carer saw in the app.
function CareRecord({ delivery }) {
  if (delivery === undefined) return <div style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>Loading care record…</div>;
  if (delivery === null) return null;
  const tasks = (delivery.assignments ?? []).flatMap((a) => a.tasks ?? []);
  const notes = (delivery.assignments ?? []).flatMap((a) => (a.notes ?? []).map((n) => ({ ...n, carer: a.employee?.name })));
  if (!tasks.length && !notes.length) {
    return <div style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>No tasks or notes recorded yet.</div>;
  }
  const done = tasks.filter((t) => t.done).length;
  return (
    <div style={s('display:flex;flex-direction:column;gap:8px')}>
      {tasks.length > 0 && (
        <>
          <div style={s('font-size:11px;font-weight:600;color:var(--d-muted)')}>Tasks — {done}/{tasks.length} done</div>
          {tasks.map((t) => (
            <div key={t.id} style={s('display:flex;align-items:center;gap:8px;background:var(--d-panel);border-radius:9px;padding:7px 10px')}>
              <span style={{ ...s('width:16px;height:16px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff'), background: t.done ? 'var(--d-primary)' : 'var(--d-field)' }}>{t.done && <Icon name="check" size={11} />}</span>
              <span style={{ ...s('font-size:12px;font-weight:600;color:var(--d-ink)'), opacity: t.done ? 1 : 0.6 }}>{t.label}</span>
            </div>
          ))}
        </>
      )}
      {notes.map((n) => (
        <div key={n.id} style={s('background:var(--d-note-bg);border-radius:9px;padding:9px 11px')}>
          <div style={s('font-size:12px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>{n.body}</div>
          <div style={s('font-size:10.5px;font-weight:600;color:var(--d-muted);margin-top:4px')}>{n.author_name ?? n.carer ?? 'Unknown'}</div>
        </div>
      ))}
    </div>
  );
}

// The right-hand shift drawer from the reference: who this visit is for, one
// staffing slot per carer required, who is free right now, the care record, the
// audit history, and the actions along the bottom. Every control here writes
// through a real endpoint.
function VisitDrawer({ visit, allVisits, employees, settings, canManage, onClose, onChanged, onCancel, onDelete }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [delivery, setDelivery] = useState(undefined);  // undefined = loading, null = failed
  const [events, setEvents] = useState(undefined);
  const [retiming, setRetiming] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const id = visit?.id;
  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    setDelivery(undefined); setEvents(undefined); setError(null); setRetiming(false); setReason('');
    getVisit(id).then((d) => live && setDelivery(d)).catch(() => live && setDelivery(null));
    listVisitEvents(id).then((e) => live && setEvents(e ?? [])).catch(() => live && setEvents(null));
    return () => { live = false; };
  }, [id]);
  useEffect(() => {
    if (!visit) return;
    setStart(formatTime(visit.scheduled_start));
    setEnd(formatTime(visit.scheduled_end));
    setNotes(visit.notes ?? '');
  }, [visit]);

  if (!visit) return null;

  const status = shiftStatus(visit);
  const req = visit.staff_required ?? 1;
  const assigned = visit.assignments ?? [];
  const editable = isEditable(visit) && canManage;
  const clashing = conflictsOn(visit, allVisits);
  const free = freeCarers(visit, employees, allVisits, 6);
  const activeCarers = employees.filter((e) => e.active);

  async function run(fn, okMessage) {
    setBusy(true); setError(null);
    try { await fn(); if (okMessage) toast.success(okMessage); await onChanged(); }
    catch (e) {
      const c = e.data?.conflict;
      const when = c ? `${formatDateFull(c.scheduled_start, { weekday: 'short', year: undefined })}, ${formatTime(c.scheduled_start)}–${formatTime(c.scheduled_end)}` : null;
      if (e.message === 'carer_unavailable') setError(`That carer is already booked with ${c?.service_user ?? 'another client'} at ${when}. A carer can't be in two places at once.`);
      else if (e.message === 'client_unavailable') setError(`${fullName(visit.service_user)} already has a carer at that time. One client, one carer at a time.`);
      else if (e.code === 'already_on_visit') setError('That carer is already on this visit.');
      else setError(e.message || 'That did not go through. Please try again.');
    } finally { setBusy(false); }
  }

  // One staffing slot: the carer in it, or Unassigned. Changing it assigns,
  // reassigns or withdraws — whichever the change actually is.
  function onSlotChange(slotAssignment, value) {
    const employeeId = value ? Number(value) : null;
    if (!employeeId && slotAssignment) return run(() => withdrawAssignment(slotAssignment.id), 'Carer removed');
    if (employeeId && slotAssignment) return run(() => reassignAssignment({ assignmentId: slotAssignment.id, employeeId }), 'Visit reassigned');
    if (employeeId) return run(() => assignEmployee({ visitId: visit.id, employeeId }), 'Carer assigned');
    return undefined;
  }

  async function saveChanges() {
    if (!reason.trim()) { toast.error('Add a reason — it goes in the audit trail'); return; }
    // Keep the visit's original UK calendar day and set the picked times as UK
    // wall-clock, so an admin working from another zone can't shift the day.
    const [y, m, d] = new Date(visit.scheduled_start).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }).split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const startAt = ukTime(base, start);
    let endAt = ukTime(base, end);
    if (endAt.getTime() <= startAt.getTime()) endAt = ukTime(base, end, 1);
    await run(() => editVisit(visit.id, {
      scheduled_start: startAt.toISOString(), scheduled_end: endAt.toISOString(),
      notes, reason: reason.trim(),
    }), 'Visit updated — change logged to the audit trail');
    setReason('');
  }

  const kv = [
    ['Address', addressOf(visit.service_user) || '—'],
    ['Run', runOf(visit)],
    ['Repeats', visit.care_package_slot_id ? 'Every week — from the care package' : 'One-off visit'],
    ['Carers needed', String(req)],
    ['Status', status[0].toUpperCase() + status.slice(1)],
  ];

  return (
    <>
      <div onClick={onClose} style={s('position:fixed;inset:0;background:rgba(9,14,19,0.28);z-index:120')} />
      <aside role="dialog" aria-label="Visit details"
        style={{ ...s('position:fixed;top:0;right:0;bottom:0;width:440px;max-width:94vw;background:var(--d-card);border-left:1px solid var(--d-border);z-index:130;display:flex;flex-direction:column;box-shadow:-14px 0 40px rgba(15,23,30,0.18)'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
        {/* head */}
        <div style={s('padding:14px 16px;border-bottom:1px solid var(--d-border);display:flex;align-items:flex-start;gap:10px;flex:none')}>
          <div style={s('flex:1;min-width:0')}>
            <div style={s('font-size:16px;font-weight:700;color:var(--d-ink);letter-spacing:-0.2px')}>{fullName(visit.service_user)}</div>
            <div className="d-num" style={s('font-size:11.5px;font-weight:600;color:var(--d-muted);margin-top:2px')}>
              {formatDateFull(visit.scheduled_start, { weekday: 'long', year: undefined })} · {isLiveIn(visit) ? 'Live-in 24h' : `${formatTime(visit.scheduled_start)}–${formatTime(visit.scheduled_end)} · ${hoursLabel(durHrs(visit))}`}
            </div>
          </div>
          <div onClick={onClose} className="hv" style={{ ...s('width:32px;height:32px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2);flex:none'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={15} /></div>
        </div>

        {/* body */}
        <div style={s('flex:1;min-height:0;overflow-y:auto;padding:14px 16px 20px;display:flex;flex-direction:column;gap:16px')}>
          <div style={s('display:flex;align-items:center;gap:6px;flex-wrap:wrap')}>
            <Tag tone={status === 'unfilled' || status === 'partial' ? 'warning' : status === 'cancelled' ? 'muted' : 'info'}>{LIFECYCLE_LABELS[stateOf(visit)] ?? 'Cancelled'}</Tag>
            {visit.status === 'draft' && <Tag tone="muted">Draft</Tag>}
            {visit.care_package_slot_id && <Tag tone="muted">↻ Recurring</Tag>}
          </div>

          {error && (
            <div style={s('border:1px solid var(--d-danger-bg2);background:var(--d-danger-bg);color:var(--d-danger-ink);border-radius:10px;padding:9px 11px;font-size:12px;font-weight:600;line-height:1.5')}>{error}</div>
          )}

          <dl style={s('display:grid;grid-template-columns:104px 1fr;gap:6px 10px;font-size:12px;margin:0')}>
            {kv.map(([k, v]) => (
              <div key={k} style={s('display:contents')}>
                <dt style={s('color:var(--d-muted);font-weight:500')}>{k}</dt>
                <dd style={s('margin:0;font-weight:600;color:var(--d-ink)')}>{v}</dd>
              </div>
            ))}
          </dl>

          {/* staffing — one slot per carer required */}
          <div style={s('border-top:1px solid var(--d-border);padding-top:13px')}>
            <div style={sectionTitle}>Staffing · {assigned.length} of {req}</div>
            {Array.from({ length: req }, (_, i) => {
              const a = assigned[i];
              const clash = a && clashing.some((c) => c.id === a.employee?.id);
              return (
                <div key={i} style={s('border:1px solid var(--d-border);border-radius:10px;padding:8px 10px;margin-bottom:7px;background:var(--d-panel)')}>
                  <div style={s('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--d-muted);margin-bottom:6px')}>Carer {i + 1}</div>
                  <select value={a?.employee?.id ?? ''} disabled={!editable || busy}
                    onChange={(e) => onSlotChange(a, e.target.value)}
                    style={{ ...fieldStyle, opacity: editable ? 1 : 0.6 }}>
                    <option value="">Unassigned</option>
                    {activeCarers.map((e) => (
                      <option key={e.id} value={e.id}>{e.full_name}{e.contracted_hours_per_week ? ` · ${e.contracted_hours_per_week}h` : ' · bank'}</option>
                    ))}
                  </select>
                  {clash && (
                    <div style={s('border:1px solid var(--d-unfilled-ink);background:var(--d-unfilled-bg);color:var(--d-unfilled-ink);border-radius:9px;padding:7px 9px;font-size:11.5px;font-weight:600;margin-top:6px;line-height:1.45')}>
                      {fullName(a.employee)} is already on another visit that overlaps this one. New assignments are blocked from clashing, so this came in with earlier data — worth fixing.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* who is actually free right now */}
          {editable && assigned.length < req && (
            <div style={s('border-top:1px solid var(--d-border);padding-top:13px')}>
              <div style={sectionTitle}>Free at this time</div>
              <div style={s('display:flex;flex-wrap:wrap;gap:6px')}>
                {free.length === 0
                  ? <span style={{ ...pillStyle, ...s('border-style:dashed;background:transparent;color:var(--d-muted);cursor:default') }}>No one is free — try advertising it</span>
                  : free.map((e) => (
                    <button key={e.id} type="button" disabled={busy} style={pillStyle}
                      onClick={() => run(() => assignEmployee({ visitId: visit.id, employeeId: e.id }), `${e.full_name} assigned`)}>
                      {e.full_name}{e.contracted_hours_per_week ? ` · ${e.contracted_hours_per_week}h` : ' · bank'}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* the rules that apply to this visit — read-only by design */}
          <div style={s('border-top:1px solid var(--d-border);padding-top:13px')}>
            <div style={sectionTitle}>Rules that apply</div>
            <div style={s('background:var(--d-note-bg);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;font-size:11.5px;font-weight:500;color:var(--d-note-ink);line-height:1.45')}>
              <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="pin" size={13} />Geofence: on site only — clock-in within 150 m</div>
              <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="clock" size={13} />Late after {settings?.late_grace_minutes ?? '—'} min grace</div>
              <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="fingerprint" size={13} />Clocked on the app (GPS); PIN tablet or manager attestation as fallbacks</div>
            </div>
          </div>

          {/* change time + notes — one audited edit */}
          {editable && retiming && (
            <div style={s('border-top:1px solid var(--d-border);padding-top:13px;display:flex;flex-direction:column;gap:10px')}>
              <div style={sectionTitle}>Change time</div>
              {assigned.some((a) => a.actual_start) && (
                <div style={s('font-size:11.5px;font-weight:500;color:var(--d-note-ink);background:var(--d-note-bg);border-radius:9px;padding:9px 11px;line-height:1.5')}>
                  The carer already clocked in — retiming changes the schedule, not the clock record. Use a clock correction to fix the actual clocked time.
                </div>
              )}
              <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:10px')}>
                <label style={s('display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--d-ink2)')}>Start
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} /></label>
                <label style={s('display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--d-ink2)')}>End
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} /></label>
              </div>
              <label style={s('display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--d-ink2)')}>Notes for this visit
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the carer needs to know on arrival"
                  style={{ ...fieldStyle, ...s('height:auto;padding:9px 12px;resize:vertical;font-weight:500') }} /></label>
              <label style={s('display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:var(--d-ink2)')}>
                <span>Reason for the change <span style={s('color:var(--d-danger-ink)')}>*</span></span>
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client asked for a later call"
                  style={{ ...fieldStyle, ...s('height:auto;padding:9px 12px;resize:vertical;font-weight:500') }} /></label>
              <div style={s('display:flex;gap:8px;justify-content:flex-end')}>
                <Button size="sm" variant="ghost" onClick={() => setRetiming(false)}>Discard</Button>
                <Button size="sm" variant="primary" icon="check" onClick={busy ? undefined : saveChanges}>{busy ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </div>
          )}

          {/* what happened on the visit */}
          <div style={s('border-top:1px solid var(--d-border);padding-top:13px')}>
            <div style={sectionTitle}>Care record</div>
            <CareRecord delivery={delivery} />
          </div>

          {/* audit trail */}
          <div style={s('border-top:1px solid var(--d-border);padding-top:13px')}>
            <div style={sectionTitle}>History</div>
            {events === undefined && <div style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>Loading history…</div>}
            {events === null && <div style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>History could not be loaded.</div>}
            {Array.isArray(events) && events.length === 0 && <div style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>Nothing recorded against this visit yet.</div>}
            {Array.isArray(events) && events.slice().reverse().map((e) => (
              <div key={e.id} style={s('display:grid;grid-template-columns:96px 1fr;gap:9px;padding:5px 0;border-bottom:1px dotted var(--d-border);font-size:11.5px')}>
                <span className="d-num" style={s('color:var(--d-muted);font-weight:500')}>{formatDateFull(e.occurred_at, { weekday: undefined, year: undefined })} {formatTime(e.occurred_at)}</span>
                <span style={s('color:var(--d-ink2);font-weight:500')}>
                  <b style={s('font-weight:700;color:var(--d-ink)')}>{EVENT_LABEL[e.event_type] ?? e.event_type.replace(/[._]/g, ' ')}</b>
                  {eventDetail(e) ? ` — ${eventDetail(e)}` : ''} · {e.actor_name ?? 'System'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* footer actions */}
        {editable && (
          <div style={s('border-top:1px solid var(--d-border);padding:11px 16px;display:flex;gap:7px;flex-wrap:wrap;flex:none;background:var(--d-card)')}>
            {visit.status === 'draft' && <Button size="sm" icon="send" onClick={busy ? undefined : () => run(() => publishVisit(visit.id), 'Visit published')}>Publish</Button>}
            <Button size="sm" variant="ghost" icon="clock" onClick={() => setRetiming((p) => !p)}>{retiming ? 'Hide time form' : 'Change time'}</Button>
            {isShort(visit) && <Button size="sm" variant="ghost" icon="send" onClick={busy ? undefined : () => run(async () => {
              const r = await broadcastCover(visit.id, null);
              toast.info(`Advertised to ${r.offered} carer${r.offered === 1 ? '' : 's'}`);
            })}>Advertise</Button>}
            <Button size="sm" variant="danger" icon="close" onClick={() => onCancel(visit)}>Cancel visit</Button>
            <Button size="sm" variant="danger" icon="trash" onClick={() => onDelete(visit)}>Delete</Button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ---------- create-visit modal (real fields only) ---------- */
function CreateVisitModal({ preset, serviceUsers, settings, weekMonday, onClose, onCreated }) {
  const toast = useToast();
  const [clientId, setClientId] = useState(preset?.clientId ?? serviceUsers[0]?.id ?? '');
  const [day, setDay] = useState(preset?.day ?? 0);
  const [start, setStart] = useState(preset?.start ?? '09:00');
  const [end, setEnd] = useState(preset?.end ?? '10:00');
  // Carers needed on this visit — 1 for a normal call, 2 for a double-up (e.g. a
  // hoist transfer that needs two carers at the same time).
  const [staffRequired, setStaffRequired] = useState(1);
  const [busy, setBusy] = useState(false);
  if (!preset) return null;
  const client = serviceUsers.find((c) => c.id === Number(clientId));

  // The single source of truth for the visit's start/end DATES — both the save
  // and the on-screen summary use it, so what you see is exactly what's saved.
  // The picked time is UK wall-clock (care happens in the UK), and an end at or
  // before the start rolls onto the next day: 22:00 -> 02:00 is a 4h overnight.
  const resolveWindow = () => {
    let base;
    if (preset?.date) { const [y, m, d] = preset.date.split('-').map(Number); base = new Date(y, m - 1, d); }
    else { base = new Date(weekMonday); base.setDate(base.getDate() + Number(day)); }
    const startDate = ukTime(base, start);
    let endDate = ukTime(base, end);
    if (endDate.getTime() <= startDate.getTime()) endDate = ukTime(base, end, 1);
    return { startDate, endDate, overnight: end <= start };
  };
  const { startDate: previewStart, endDate: previewEnd, overnight } = resolveWindow();
  const fmt = (d) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', timeZoneName: 'short' });
  const mins = Math.round((previewEnd - previewStart) / 60000);

  async function save() {
    if (!clientId) { toast.error('Pick a client'); return; }
    const { startDate, endDate } = resolveWindow();
    if (startDate.getTime() < Date.now()) { toast.error("You can't create a visit in the past — pick a future date and time."); return; }
    if (endDate.getTime() - startDate.getTime() < 15 * 60000) { toast.error('A visit must be at least 15 minutes long.'); return; }
    setBusy(true);
    try {
      await createVisit({
        service_user_id: Number(clientId), scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(), staff_required: Number(staffRequired),
      });
      toast.success(`Visit created for ${fullName(client)}`);
      onCreated(); onClose();
    } catch (err) {
      toast.error(err.message === 'client_overlap' ? `${fullName(client)} already has a visit at that time — one client, one visit at a time.`
        : err.message === 'visit_in_past' ? "You can't create a visit in the past."
          : (err.message || 'Could not create the visit'));
    } finally { setBusy(false); }
  }

  const label = s('font-size:11.5px;font-weight:700;color:var(--d-ink2)');
  const field = s('display:flex;flex-direction:column;gap:6px');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Modal title="New visit" subtitle="Add a one-off visit to the rota. It starts as a draft until you publish." onClose={onClose}
      footer={(
        <div style={s('display:flex;justify-content:flex-end;gap:8px')}>
          <span data-tour="rota-create-cancel"><Button variant="ghost" onClick={onClose}>Cancel</Button></span>
          <Button variant="primary" icon="check" onClick={busy ? undefined : save}>{busy ? 'Creating…' : 'Create visit'}</Button>
        </div>
      )}>
      <div data-tour="rota-create-fields" style={s('padding:18px 22px;display:flex;flex-direction:column;gap:16px')}>
        <div style={field}><span style={label}>Client</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={fieldStyle}>
            {serviceUsers.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
          </select>
        </div>
        {!preset?.date && (
          <div style={field}><span style={label}>Day</span>
            <select value={day} onChange={(e) => setDay(e.target.value)} style={fieldStyle}>
              {days.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
        )}
        <div style={field}><span style={label}>Carers needed</span>
          <input type="number" min={1} max={10} step={1} value={staffRequired}
            onChange={(e) => setStaffRequired(e.target.value)}
            onBlur={(e) => setStaffRequired(Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))))}
            style={fieldStyle} />
          {Number(staffRequired) > 1 && (
            <span style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>A double-up visit. You’ll add the other carer{Number(staffRequired) > 2 ? 's' : ''} from the visit after it’s created.</span>
          )}
        </div>
        <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
          <div style={field}><span style={label}>Start</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} /></div>
          <div style={field}><span style={label}>End</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} /></div>
        </div>
        {/* The resolved window, so an overnight visit's real end DATE is explicit. */}
        <div style={{ ...s('display:flex;flex-direction:column;gap:5px;border-radius:10px;padding:9px 12px'), background: overnight ? 'var(--d-note-bg)' : 'var(--d-panel)' }}>
          <div style={s('display:flex;justify-content:space-between;gap:12px;font-size:12px;font-weight:600;color:var(--d-ink)')}><span style={s('color:var(--d-muted)')}>Starts</span><span className="d-num">{fmt(previewStart)}</span></div>
          <div style={s('display:flex;justify-content:space-between;gap:12px;font-size:12px;font-weight:600;color:var(--d-ink)')}><span style={s('color:var(--d-muted)')}>Ends</span><span className="d-num">{fmt(previewEnd)}</span></div>
          <div style={s('display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--d-note-ink);margin-top:1px')}>
            <Icon name="clock" size={12} />{`${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`}{overnight ? ' · overnight — ends the next day' : ''}
          </div>
        </div>
        <div style={s('font-size:11.5px;font-weight:500;color:var(--d-note-ink);background:var(--d-note-bg);border-radius:10px;padding:10px 12px;line-height:1.45')}>
          Geofence: on site only, within 150 m · late after {settings?.late_grace_minutes ?? '—'} min grace.
        </div>
      </div>
    </Modal>
  );
}

/* ================================== page ================================== */

export default function RotaPage() {
  const toast = useToast();
  const { canManage } = useAuth();

  const [weekStart, setWeekStart] = useState(() => weekOf().monday);
  const [dayDate, setDayDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [view, setView] = useState('week');            // week | day | queue | staff
  const [visits, setVisits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [serviceUsers, setServiceUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filters — the reference's rail, moved to the top bar.
  const [fClient, setFClient] = useState('all');
  const [fCarer, setFCarer] = useState('all');
  const [fRun, setFRun] = useState('all');
  const [fStatus, setFStatus] = useState({ unfilled: true, partial: true, filled: true, completed: true, cancelled: true });
  const [flagConflicts, setFlagConflicts] = useState(true);

  const [selected, setSelected] = useState([]);
  const [drawerId, setDrawerId] = useState(null);
  const [creating, setCreating] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [advertising, setAdvertising] = useState(null); // { done, total } while a bulk advertise runs
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [weekMode, setWeekMode] = useState('hours'); // 'hours' (clock timeline, the default) | 'runs' (grouped by care run)

  const range = useMemo(() => weekOf(weekStart), [weekStart]);

  // One load per week: every view (week grid, day list, unfilled queue, staff
  // load) reads the same Mon–Sun set, exactly as the reference does.
  const load = useCallback(async () => {
    const [v, e, su, st] = await Promise.all([
      listVisits({ from: range.from, to: range.to }),
      listEmployees().catch(() => []),
      listServiceUsers().catch(() => []),
      getSettings().catch(() => null),
    ]);
    setVisits(v ?? []); setEmployees(e ?? []); setServiceUsers(su ?? []); setSettings(st);
  }, [range.from, range.to]);

  useEffect(() => { let a = true; setLoading(true); load().finally(() => a && setLoading(false)); return () => { a = false; }; }, [load]);
  useEffect(() => {
    const onKey = (e) => { if (e.key !== 'Escape') return; if (drawerId) setDrawerId(null); else if (selected.length) setSelected([]); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerId, selected.length]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(range.monday); d.setDate(d.getDate() + i);
    return { date: d, iso: isoDate(d), label: d.toLocaleDateString('en-GB', { weekday: 'short' }), num: d.getDate(), today: d.toDateString() === new Date().toDateString() };
  }), [range.monday]);

  // Everything on screen, narrowed by the filter row.
  const shown = useMemo(() => visits.filter((v) => {
    if (fClient !== 'all' && v.service_user?.id !== Number(fClient)) return false;
    if (fCarer !== 'all' && !(v.assignments ?? []).some((a) => a.employee?.id === Number(fCarer))) return false;
    if (fRun !== 'all' && runOf(v) !== fRun) return false;
    return !!fStatus[shiftStatus(v)];
  }), [visits, fClient, fCarer, fRun, fStatus]);

  const drafts = useMemo(() => visits.filter((v) => v.status === 'draft'), [visits]);
  const drawerVisit = useMemo(() => visits.find((v) => v.id === drawerId) ?? null, [visits, drawerId]);
  const weekTotals = useMemo(() => {
    const live = shown.filter((v) => v.status !== 'cancelled');
    return {
      gaps: dayStats(shown),
      hours: live.reduce((a, v) => a + durHrs(v) * (v.staff_required ?? 1), 0),
      liveIn: shown.filter(isLiveIn).length,
      clashes: flagConflicts ? shown.filter((v) => conflictsOn(v, visits).length > 0).length : 0,
    };
  }, [shown, visits, flagConflicts]);

  const activeFilters = (fClient !== 'all' ? 1 : 0) + (fCarer !== 'all' ? 1 : 0) + (fRun !== 'all' ? 1 : 0)
    + STATUS_CHIPS.filter(([k]) => !fStatus[k]).length;

  const staffRows = useMemo(() => employees.filter((e) => e.active && (fCarer === 'all' || e.id === Number(fCarer)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name)), [employees, fCarer]);

  /* ------------------------------- navigation ------------------------------ */
  const move = (n) => {
    if (view === 'day') {
      const d = new Date(dayDate); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0);
      setDayDate(d); setWeekStart(weekOf(d).monday);
      return;
    }
    const d = new Date(range.monday); d.setDate(d.getDate() + n * 7); setWeekStart(d);
  };
  const goToday = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setDayDate(d); setWeekStart(weekOf().monday);
  };
  const pickDay = (date) => { setDayDate(date); setWeekStart(weekOf(date).monday); setView('day'); };
  const toggleSel = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /* --------------------------------- actions ------------------------------- */
  async function assignFromQueue(v, e) {
    try { await assignEmployee({ visitId: v.id, employeeId: e.id }); toast.success(`${e.full_name} assigned to ${fullName(v.service_user)}`); await load(); }
    catch (err) { toast.error(err.message === 'carer_unavailable' ? `${e.full_name} already has a visit at that time.` : (err.message || 'Could not assign that carer')); }
  }
  async function advertise(v) {
    try { const r = await broadcastCover(v.id, null); toast.success(`Advertised to ${r.offered} carer${r.offered === 1 ? '' : 's'}`); await load(); }
    catch (err) { toast.error(err.message === 'visit_already_filled' ? 'That visit is already filled.' : (err.message || 'Could not advertise the visit')); }
  }
  // Advertising every gap on screen reaches real carers' phones and cannot be
  // recalled, so it asks first with the real numbers — and is paced (runPaced)
  // so the rest of the console stays usable while it works.
  function advertiseAll() {
    const gaps = shown.filter((v) => isShort(v));
    if (!gaps.length) { toast.info('Nothing unfilled to advertise.'); return; }
    const carers = employees.filter((e) => e.active).length;
    setConfirm({
      title: `Advertise ${gaps.length} unfilled visit${gaps.length === 1 ? '' : 's'}?`,
      body: `Every carer who is free at that time gets an in-app message and a push notification — up to ${carers} carer${carers === 1 ? '' : 's'} per visit, so roughly ${gaps.length * carers} notifications. Carers who already have an offer are notified again. This reaches real phones and can't be undone.`,
      confirmLabel: `Advertise ${gaps.length}`,
      onConfirm: async () => {
        setBusy(true);
        setAdvertising({ done: 0, total: gaps.length });
        try {
          const { ok, failed, results } = await runPaced(
            gaps, (v) => broadcastCover(v.id, null), ADVERTISE_LANES,
            () => setAdvertising((p) => (p ? { ...p, done: p.done + 1 } : p)),
          );
          const offers = results.reduce((a, r) => a + (r?.offered ?? 0), 0);
          if (ok) toast.success(`${ok} visit${ok === 1 ? '' : 's'} advertised — ${offers} offer${offers === 1 ? '' : 's'} sent`);
          if (failed) toast.warn(`${failed} could not be advertised (already filled, or the request failed).`);
          await load();
        } finally { setBusy(false); setAdvertising(null); }
      },
    });
  }
  function askCancel(v) {
    setConfirm({
      title: 'Cancel this visit?',
      body: 'The visit is marked cancelled and the carer is freed. Its record is kept.',
      confirmLabel: 'Cancel visit', danger: true, needReason: true, reasonLabel: 'Reason for cancelling',
      onConfirm: async (reason) => {
        try { await cancelVisit(v.id, reason); toast.success('Visit cancelled — carer freed'); setDrawerId(null); await load(); }
        catch (e) { toast.error(e.message === 'visit_started' ? 'A carer has clocked in — that visit cannot be cancelled.' : (e.message || 'Could not cancel the visit')); }
      },
    });
  }
  function askDelete(v) {
    setConfirm({
      title: 'Delete this visit for good?',
      body: 'It leaves the rota and the carer is freed. Cancel it instead if it may need a record — deletion is refused once a carer has clocked in.',
      confirmLabel: 'Delete visit', danger: true,
      onConfirm: async () => {
        try { await deleteVisit(v.id); toast.success('Visit deleted — carer freed'); setDrawerId(null); await load(); }
        catch (e) { toast.error(e.message === 'visit_started' ? 'A carer has clocked in — cancel it instead so the record is kept.' : (e.message || 'Could not delete the visit')); }
      },
    });
  }
  // Build the NEXT Mon–Sun from today (not the viewed week) from the care
  // packages, then jump the view to it.
  async function generateNextWeek() {
    setBusy(true);
    try {
      const nextMon = new Date(weekOf(new Date()).monday);
      nextMon.setDate(nextMon.getDate() + 7);
      const nextSun = new Date(nextMon); nextSun.setDate(nextSun.getDate() + 6);
      const r = await generateVisits({ from: isoDate(nextMon), to: isoDate(nextSun) });
      toast.success(`${r.created} visit${r.created === 1 ? '' : 's'} generated for next week`);
      setWeekStart(nextMon);
    } catch (e) { toast.error(e.message || 'Could not generate next week'); } finally { setBusy(false); }
  }
  async function publishAll() {
    if (!drafts.length) { toast.info('No draft visits to publish'); return; }
    setBusy(true);
    try { await Promise.all(drafts.map((v) => publishVisit(v.id))); toast.success(`Rota published — ${drafts.length} visit${drafts.length === 1 ? '' : 's'} now visible to carers`); await load(); }
    catch (e) { toast.error(e.message || 'Some visits could not be published'); } finally { setBusy(false); }
  }

  const selectedVisits = () => visits.filter((v) => selected.includes(v.id));
  async function bulkUnassign() {
    const rows = selectedVisits().flatMap((v) => (v.assignments ?? []).filter((a) => !a.actual_start));
    if (!rows.length) { toast.info('Nothing to unassign — those visits have no carer, or the carer has clocked in.'); return; }
    try { await Promise.all(rows.map((a) => withdrawAssignment(a.id))); toast.success(`${rows.length} carer${rows.length === 1 ? '' : 's'} removed`); setSelected([]); await load(); }
    catch (e) { toast.error(e.message || 'Some carers could not be removed'); }
  }
  async function bulkAdvertise() {
    const gaps = selectedVisits().filter(isShort);
    if (!gaps.length) { toast.info('None of the selected visits need cover'); return; }
    const { ok, failed } = await runPaced(gaps, (v) => broadcastCover(v.id, null), ADVERTISE_LANES);
    if (ok) toast.success(`${ok} visit${ok === 1 ? '' : 's'} advertised`);
    if (failed) toast.warn(`${failed} could not be advertised`);
    setSelected([]); await load();
  }
  async function bulkPublish() {
    const d = selectedVisits().filter((v) => v.status === 'draft');
    if (!d.length) { toast.info('None of the selected visits are drafts'); return; }
    try { await Promise.all(d.map((v) => publishVisit(v.id))); toast.success(`${d.length} visit${d.length === 1 ? '' : 's'} published`); setSelected([]); await load(); }
    catch (e) { toast.error(e.message || 'Some could not be published'); }
  }
  async function bulkShift(mins) {
    const rows = selectedVisits().filter((v) => isEditable(v) && !(v.assignments ?? []).some((a) => a.actual_start));
    if (!rows.length) { toast.info('Selected visits have already started — cannot retime'); return; }
    const shift = (iso) => new Date(new Date(iso).getTime() + mins * 60000).toISOString();
    try {
      await Promise.all(rows.map((v) => editVisit(v.id, { scheduled_start: shift(v.scheduled_start), scheduled_end: shift(v.scheduled_end), reason: `Bulk time shift ${mins > 0 ? '+' : ''}${mins} min from the rota` })));
      toast.success(`${rows.length} visit${rows.length === 1 ? '' : 's'} shifted ${mins > 0 ? '+' : ''}${mins} min`); setSelected([]); await load();
    } catch (e) { toast.error(e.message || 'Some visits could not be shifted'); }
  }
  function bulkCancel() {
    const rows = selectedVisits().filter(isEditable);
    if (!rows.length) { toast.info('Those visits are already cancelled'); return; }
    setConfirm({
      title: `Cancel ${rows.length} visit${rows.length === 1 ? '' : 's'}?`,
      body: 'Each visit is marked cancelled and its carer freed. The records are kept.',
      confirmLabel: 'Cancel visits', danger: true, needReason: true, reasonLabel: 'Reason for cancelling',
      onConfirm: async (reason) => {
        const res = await Promise.allSettled(rows.map((v) => cancelVisit(v.id, reason)));
        const ok = res.filter((r) => r.status === 'fulfilled').length;
        if (ok) toast.success(`${ok} visit${ok === 1 ? '' : 's'} cancelled`);
        if (ok < rows.length) toast.warn(`${rows.length - ok} could not be cancelled (a carer may have clocked in).`);
        setSelected([]); await load();
      },
    });
  }

  /* --------------------------------- render -------------------------------- */
  const VIEWS = [
    { key: 'week', label: 'Week', icon: 'calendar' },
    { key: 'day', label: 'Day', icon: 'clock' },
    { key: 'queue', label: 'Unfilled', icon: 'alert', count: weekTotals.gaps.unf },
    { key: 'staff', label: 'Staff', icon: 'users' },
  ];
  const rangeLabel = view === 'day'
    ? dayDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : `${range.monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${range.sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div style={s('display:flex;flex-direction:column;gap:12px')}>
      {/* ---- command bar: the reference's top bar AND its left rail, at the top.
           Three bands with a clear break between them — navigate/act, then the
           week at a glance, then narrow it down. The summary is one slim line
           rather than two stacked boxes: it was the single biggest eater of the
           vertical space the grid actually needs. ---- */}
      <div style={s('background:var(--d-card);border:1px solid var(--d-border);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:12px')}>
        {/* band 1 — one line: which week, which view, and the actions */}
        <div style={s('display:flex;align-items:center;gap:7px;flex-wrap:wrap')}>
          <div data-tour="rota-week" style={s('display:flex;align-items:center;height:30px;border:1px solid var(--d-border);border-radius:9px;overflow:hidden')}>
            <div className="hv" onClick={() => move(-1)} aria-label="Previous" style={{ ...s('width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-panel)' }}><Icon name="chevronLeft" size={15} /></div>
            {/* The range doubles as the way back to the current week. */}
            <span className="d-num hv" onClick={goToday} title="Jump to this week"
              style={{ ...s('padding:0 11px;font-size:12px;font-weight:700;color:var(--d-ink);white-space:nowrap;border-left:1px solid var(--d-border);border-right:1px solid var(--d-border);line-height:28px;cursor:pointer'), '--hbg': 'var(--d-panel)' }}>{rangeLabel}</span>
            <div className="hv" onClick={() => move(1)} aria-label="Next" style={{ ...s('width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), '--hbg': 'var(--d-panel)' }}><Icon name="chevronRight" size={15} /></div>
          </div>
          <div data-tour="rota-view" style={s('display:inline-flex;align-items:center;gap:2px;background:var(--d-panel);border-radius:9px;padding:2px')}>
            {VIEWS.map((o) => (
              <div key={o.key} onClick={() => setView(o.key)} title={`${o.label} view`}
                style={{ ...s('display:flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:700'), background: view === o.key ? 'var(--d-card)' : 'transparent', color: view === o.key ? 'var(--d-ink)' : 'var(--d-muted)', boxShadow: view === o.key ? '0 1px 2px rgba(15,23,32,0.10)' : 'none' }}>
                <Icon name={o.icon} size={12} />{o.label}
                {o.count > 0 && <span className="d-num" style={{ ...s('min-width:15px;height:15px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;padding:0 4px'), background: 'var(--d-unfilled-bg)', color: 'var(--d-unfilled-ink)' }}>{o.count}</span>}
              </div>
            ))}
          </div>
          {view === 'week' && (
            <div style={s('display:inline-flex;align-items:center;gap:2px;background:var(--d-panel);border-radius:9px;padding:2px')}>
              {[['runs', 'Runs'], ['hours', 'Hours']].map(([k, label]) => (
                <div key={k} onClick={() => setWeekMode(k)}
                  title={k === 'runs' ? 'Group the week by care run — morning, lunch, tea, bed' : 'Show the week on a clock axis, to see overlapping calls'}
                  style={{ ...s('height:26px;padding:0 9px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:700;display:flex;align-items:center'), background: weekMode === k ? 'var(--d-card)' : 'transparent', color: weekMode === k ? 'var(--d-ink)' : 'var(--d-muted)', boxShadow: weekMode === k ? '0 1px 2px rgba(15,23,32,0.10)' : 'none' }}>
                  {label}
                </div>
              ))}
            </div>
          )}
          {/* Every action is still here. The four secondary ones sit in one
              grouped cluster of icons rather than four competing labelled
              buttons, so the row holds one line and "Add visit" is visibly the
              primary thing. Each carries its full wording on hover. */}
          <div style={s('display:flex;align-items:center;gap:7px;margin-left:auto')}>
            <div style={s('display:inline-flex;align-items:center;height:30px;border:1px solid var(--d-border);border-radius:9px;overflow:hidden')}>
              {[
                { key: 'refresh', icon: 'refresh', label: 'Refresh the rota', onClick: () => load(), show: true },
                { key: 'advertise', icon: 'send', label: 'Advertise unfilled visits to available carers', onClick: busy ? undefined : advertiseAll, show: canManage },
                { key: 'generate', icon: 'sync', label: 'Generate next week from the care packages', onClick: busy ? undefined : generateNextWeek, show: canManage, tour: 'rota-generate' },
                { key: 'publish', icon: 'check', label: drafts.length ? `Publish rota — ${drafts.length} unpublished` : 'Publish rota', onClick: busy ? undefined : publishAll, show: canManage, badge: drafts.length },
              ].filter((a) => a.show).map((a, i) => (
                <div key={a.key} data-tour={a.tour} onClick={a.onClick} className="hv" title={a.label} aria-label={a.label}
                  style={{ ...s('position:relative;width:34px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2)'), borderLeft: i === 0 ? 'none' : '1px solid var(--d-border)', '--hbg': 'var(--d-panel)' }}>
                  <Icon name={a.icon} size={14} />
                  {a.badge > 0 && <span style={s('position:absolute;top:4px;right:5px;width:6px;height:6px;border-radius:50%;background:var(--d-warn-dot)')} />}
                </div>
              ))}
            </div>
            {advertising && (
              <span className="d-num" style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2);white-space:nowrap')}>
                Advertising {advertising.done}/{advertising.total}
              </span>
            )}
            {canManage && (
              <ExportButton label="Export rota" title="Export rota" size="xs" variant="primary" subtitle="Choose a file format. The week on screen is exported."
                onExport={async (type) => { try { await exportRota(range.from, range.to, type); toast.success(`Rota ${type.toUpperCase()} downloaded`); } catch (e) { toast.error(e.message || 'Export failed'); return false; } }} />
            )}
            {canManage && <span data-tour="rota-add"><Button size="xs" variant="primary" icon="plus" onClick={() => setCreating({ day: 0 })}>Add visit</Button></span>}
          </div>
        </div>

        {/* band 2 — the week at a glance, and the way in to narrowing it.
             Filters live behind a button rather than a permanent row: they are
             used occasionally, and the row they occupied is worth more to the
             grid, which is what people actually came here to read. */}
        <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--d-panel);border-radius:11px;padding:7px 12px')}>
          <button type="button" onClick={() => setView('queue')} title="Open the unfilled queue"
            style={{
              ...s('display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 11px;border-radius:99px;border:0;cursor:pointer;font-size:12px;font-weight:600'),
              fontFamily: 'inherit',
              background: weekTotals.gaps.unf ? 'var(--d-unfilled-bg)' : 'var(--d-ok-bg)',
              color: weekTotals.gaps.unf ? 'var(--d-unfilled-ink)' : 'var(--d-ok-ink)',
            }}>
            <span className="d-num" style={s('font-size:14px;font-weight:800;line-height:1')}>{weekTotals.gaps.unf}</span>
            {weekTotals.gaps.unf ? `unfilled · ${hoursTotal(weekTotals.gaps.hrs)} uncovered` : 'fully covered'}
          </button>
          <span style={s('width:1px;height:18px;background:var(--d-border)')} />
          {[['Visits', shown.length], ['Care hours', `${Math.round(weekTotals.hours)}h`], ['Live-in', weekTotals.liveIn], ['Clashes', weekTotals.clashes]].map(([l, val]) => (
            <span key={l} style={s('display:inline-flex;align-items:baseline;gap:5px;font-size:11.5px;font-weight:600;color:var(--d-muted);white-space:nowrap')}>
              <span className="d-num" style={{ ...s('font-size:13.5px;font-weight:800'), color: l === 'Clashes' && weekTotals.clashes > 0 ? 'var(--d-unfilled-ink)' : 'var(--d-ink)' }}>{val}</span>{l}
            </span>
          ))}
          <span style={s('flex:1;min-width:4px')} />
          <Tag tone={drafts.length ? 'warning' : 'success'}>{drafts.length ? `Draft — ${drafts.length} unpublished` : 'Published'}</Tag>
          <div style={s('position:relative')}>
            <button type="button" data-tour="rota-filters" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}
              style={{ ...s('display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 11px;border-radius:99px;cursor:pointer;font-size:11.5px;font-weight:600'), fontFamily: 'inherit', border: `1px solid ${activeFilters ? 'var(--d-primary)' : 'var(--d-border)'}`, background: activeFilters ? 'var(--d-primary-soft)' : 'var(--d-card)', color: activeFilters ? 'var(--d-primary-deep)' : 'var(--d-ink2)' }}>
              <Icon name="filter" size={13} />Filters
              {activeFilters > 0 && <span className="d-num" style={{ ...s('min-width:16px;height:16px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;padding:0 4px'), background: 'var(--d-primary)', color: 'var(--d-primary-ink)' }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <>
                <div onClick={() => setFiltersOpen(false)} style={s('position:fixed;inset:0;z-index:40')} />
                <div style={s('position:absolute;top:32px;right:0;z-index:41;width:330px;background:var(--d-card);border:1px solid var(--d-border);border-radius:14px;box-shadow:0 16px 40px rgba(15,23,30,0.22);padding:14px;display:flex;flex-direction:column;gap:11px')}>
                  <select value={fClient} onChange={(e) => setFClient(e.target.value)} style={{ ...selectStyle, width: '100%' }} aria-label="Filter by client">
                    <option value="all">All clients</option>
                    {[...serviceUsers].filter((c) => c.active).sort((a, b) => fullName(a).localeCompare(fullName(b))).map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
                  </select>
                  <select value={fCarer} onChange={(e) => setFCarer(e.target.value)} style={{ ...selectStyle, width: '100%' }} aria-label="Filter by carer">
                    <option value="all">All carers</option>
                    {[...employees].filter((e) => e.active).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                  <select value={fRun} onChange={(e) => setFRun(e.target.value)} style={{ ...selectStyle, width: '100%' }} aria-label="Filter by run">
                    <option value="all">All runs</option>
                    {RUN_ORDER.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div style={s('display:flex;flex-wrap:wrap;gap:6px;border-top:1px solid var(--d-border);padding-top:11px')}>
                    {STATUS_CHIPS.map(([k, label]) => {
                      const on = fStatus[k];
                      return (
                        <button key={k} type="button" onClick={() => setFStatus((p) => ({ ...p, [k]: !p[k] }))} aria-pressed={on}
                          style={{ ...s('display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border-radius:99px;font-size:11.5px;font-weight:600;cursor:pointer'), fontFamily: 'inherit', border: `1px solid ${on ? 'var(--d-border)' : 'transparent'}`, background: on ? 'var(--d-panel)' : 'transparent', color: on ? 'var(--d-ink)' : 'var(--d-muted)', opacity: on ? 1 : 0.5 }}>
                          <span style={{ ...s('width:8px;height:8px;border-radius:50%'), background: styleFor(k).bar }} />{label}
                        </button>
                      );
                    })}
                  </div>
                  {/* The reference's other two options ("Show standby", "Travel
                      time gaps") are not drawn: no standby state, no travel data. */}
                  <button type="button" onClick={() => setFlagConflicts((p) => !p)} aria-pressed={flagConflicts}
                    style={{ ...s('display:inline-flex;align-items:center;gap:8px;height:30px;padding:0;border:0;background:none;font-size:12px;font-weight:600;color:var(--d-ink2);cursor:pointer;border-top:1px solid var(--d-border);padding-top:11px'), fontFamily: 'inherit' }}>
                    <span style={{ ...s('width:28px;height:16px;border-radius:99px;position:relative;display:inline-block;flex:none'), background: flagConflicts ? 'var(--d-primary)' : 'var(--d-track)' }}>
                      <span style={{ ...s('position:absolute;top:2px;width:12px;height:12px;border-radius:50%;background:var(--d-card)'), left: flagConflicts ? 14 : 2 }} />
                    </span>
                    Flag clashes
                  </button>
                  {activeFilters > 0 && (
                    <button type="button" onClick={() => { setFClient('all'); setFCarer('all'); setFRun('all'); setFStatus({ unfilled: true, partial: true, filled: true, completed: true, cancelled: true }); }}
                      style={{ ...s('height:30px;border-radius:9px;border:1px solid var(--d-border);background:transparent;font-size:12px;font-weight:600;color:var(--d-ink2);cursor:pointer'), fontFamily: 'inherit' }}>Clear filters</button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- the rota itself ---- */}
      {loading ? <Spinner /> : (
        <div data-tour="rota-grid" style={s('background:var(--d-card);border-radius:16px;border:1px solid var(--d-border)')}>
          <div>
            <div>
              <CoverStrip days={weekDays} visits={shown} onPickDay={pickDay} cols={view === 'week' && weekMode === 'runs' ? RUN_COLS : GRID_COLS} />

              {view === 'week' && weekMode === 'runs' && (
                <WeekRuns days={weekDays} visits={shown} allVisits={visits} selected={selected}
                  flagConflicts={flagConflicts} onOpen={(v) => setDrawerId(v.id)} onToggleSelect={toggleSel}
                  canAdd={canManage} onAdd={(iso) => setCreating({ date: iso, start: '09:00', end: '10:00' })} />
              )}

              {view === 'week' && weekMode === 'hours' && (
                <>
                  {/* live-in band — 24h shifts never eat a lane in the timeline */}
                  <div style={{ ...s('display:grid;background:var(--d-panel2);border-bottom:2px solid var(--d-track)'), gridTemplateColumns: GRID_COLS }}>
                    <div style={s('border-right:1px solid var(--d-border);font-size:9px;font-weight:700;color:var(--d-muted);padding:6px 8px;display:flex;align-items:center')}>Live-in</div>
                    {weekDays.map((d) => (
                      <div key={d.iso} style={s('border-left:1px solid var(--d-border);padding:5px;display:flex;flex-direction:column;gap:3px;min-height:32px')}>
                        {shown.filter((v) => isLiveIn(v) && ukDay(v.scheduled_start) === d.iso).map((v) => (
                          <LiveInChip key={v.id} v={v} selected={selected.includes(v.id)}
                            conflicted={flagConflicts && conflictsOn(v, visits).length > 0}
                            onOpen={(x) => setDrawerId(x.id)} onToggleSelect={toggleSel} />
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* the timeline */}
                  <div style={{ ...s('display:grid'), gridTemplateColumns: GRID_COLS }}>
                    <TimeRuler />
                    {weekDays.map((d) => (
                      <DayColumn key={d.iso} dayISO={d.iso} visits={shown} allVisits={visits} selected={selected}
                        flagConflicts={flagConflicts} today={d.today} weekend={d.date.getDay() === 0 || d.date.getDay() === 6}
                        onOpen={(v) => setDrawerId(v.id)} onToggleSelect={toggleSel} canAdd={canManage}
                        onAdd={(min) => setCreating({ date: d.iso, start: minToHHMM(min), end: minToHHMM(Math.min(1439, min + 60)) })} />
                    ))}
                  </div>
                </>
              )}

              {view === 'day' && (
                <DayPane date={dayDate} visits={shown} allVisits={visits} flagConflicts={flagConflicts} onOpen={(v) => setDrawerId(v.id)} />
              )}
              {view === 'queue' && (
                <QueuePane days={weekDays} visits={shown} allVisits={visits} employees={employees} canManage={canManage}
                  onOpen={(v) => setDrawerId(v.id)} onAssign={assignFromQueue} onAdvertise={advertise} />
              )}
              {view === 'staff' && (
                <StaffPane days={weekDays} employees={staffRows} visits={shown} allVisits={visits} flagConflicts={flagConflicts} onOpen={(v) => setDrawerId(v.id)} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- bulk bar ---- */}
      {selected.length > 0 && (
        <div style={s('position:sticky;bottom:16px;z-index:30;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:fit-content;max-width:100%;background:var(--d-card);border:1px solid var(--d-border);border-radius:999px;padding:7px 12px;box-shadow:0 12px 30px rgba(15,23,30,0.18)')}>
          <span className="d-num" style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);padding:0 4px')}>{selected.length} selected</span>
          {canManage && <Button size="sm" variant="ghost" icon="close" onClick={bulkUnassign}>Unassign</Button>}
          {canManage && <Button size="sm" variant="ghost" icon="send" onClick={bulkAdvertise}>Advertise</Button>}
          {canManage && <Button size="sm" variant="ghost" icon="check" onClick={bulkPublish}>Publish</Button>}
          {canManage && <Button size="sm" variant="ghost" icon="clock" onClick={() => bulkShift(-15)}>−15 min</Button>}
          {canManage && <Button size="sm" variant="ghost" icon="clock" onClick={() => bulkShift(15)}>+15 min</Button>}
          {canManage && <Button size="sm" variant="danger" icon="close" onClick={bulkCancel}>Cancel</Button>}
          <Button size="sm" variant="subtle" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      {drawerVisit && (
        <VisitDrawer visit={drawerVisit} allVisits={visits} employees={employees} settings={settings} canManage={canManage}
          onClose={() => setDrawerId(null)} onChanged={load} onCancel={askCancel} onDelete={askDelete} />
      )}
      {creating && (
        <CreateVisitModal preset={creating} serviceUsers={serviceUsers} settings={settings} weekMonday={range.monday}
          onClose={() => setCreating(null)} onCreated={load} />
      )}
      <ConfirmDialog dialog={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
