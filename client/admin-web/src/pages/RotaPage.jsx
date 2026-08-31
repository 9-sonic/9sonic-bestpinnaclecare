import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listVisits, listEmployees, listServiceUsers, getSettings,
  assignEmployee, withdrawAssignment, publishVisit, generateVisits, createVisit, editVisit,
  exportRota, getVisit, reassignAssignment, cancelVisit, deleteVisit,
} from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import Modal from '../components/common/Modal.jsx';
import InfoHint from '../components/common/InfoHint.jsx';
import ContextMenu from '../components/common/ContextMenu.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LIFECYCLE_LABELS, LIFECYCLE_TONE, formatTime, formatTimeRange, formatDateFull, fullName, weekOf, isoDate, ukTime,
} from '../api/format.js';
import { Button, ExportButton, Tag, Avatar, SegTabs, TableWrap, Th, Td, Row, Pager } from '../ds/console.jsx';

// A cancelled visit is not "short-staffed" — it's cancelled. Only a live visit
// with fewer active carers than required counts as unfilled.
const isShort = (v) => v.status !== 'cancelled' && (v.assignments ?? []).length < v.staff_required;
const sameDay = (iso, d) => new Date(iso).toDateString() === d.toDateString();
const inits = (p) => ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')) || '—';

// Lifecycle state -> chip colour, mirroring the design's lifecycleMeta.
// The six shared tones, but with a DISTINCT colour each — previously `info` and
// `active` were both blue, so "due now" and "on shift" looked identical. Every
// token exists in both light and dark themes, so these read in either mode.
// Main's soft-card design (light tinted background + coloured text), but with the
// distinct colours: blue/violet/yellow/red/green — none alike. `bg` is a light
// wash of the colour over the card; `ink`/`dot` is the full colour.
const soft = (col) => `color-mix(in srgb, ${col} 16%, var(--d-card))`;
// Visit-state colours read from the console's semantic status tokens rather than
// raw hex, so the rota themes for dark mode and matches the status language used
// everywhere else (and the PWA). Scheduled/check-in use the brand teal instead
// of a generic blue; on-shift keeps a distinct magenta so "in progress" stands
// apart from "scheduled" at a glance.
const CHIP = {
  neutral: { bg: soft('var(--d-primary)'), ink: 'var(--d-primary-deep)', dot: 'var(--d-primary)' }, // scheduled
  info: { bg: soft('var(--d-primary)'), ink: 'var(--d-primary-deep)', dot: 'var(--d-primary)' },    // check-in
  active: { bg: soft('var(--d-magenta)'), ink: 'var(--d-magenta)', dot: 'var(--d-magenta)' },       // on shift
  warn: { bg: 'var(--d-warn-bg)', ink: 'var(--d-warn-ink)', dot: 'var(--d-warn-dot)' },             // late
  danger: { bg: 'var(--d-danger-bg)', ink: 'var(--d-danger-ink)', dot: 'var(--d-danger-dot)' },     // missed
  success: { bg: 'var(--d-ok-bg)', ink: 'var(--d-ok-ink)', dot: 'var(--d-ok-ink)' },                // completed
};
// A cancelled visit reads its state from the visit status, not the assignment
// (its carer was withdrawn, so there's no active assignment to read from).
const stateOf = (v) => (v.status === 'cancelled' ? 'cancelled' : (v.assignments?.[0]?.lifecycle_state) ?? 'scheduled');
const chipFor = (v) => (isShort(v) ? null : CHIP[LIFECYCLE_TONE[stateOf(v)] ?? 'neutral']);
// Lifecycle tone -> the Tag component's tone names (list view's status pill).
const L2TAG = { neutral: 'muted', info: 'info', warn: 'warning', active: 'info', danger: 'danger', success: 'success' };

// A visit is editable unless it's cancelled — its record stands. Past and
// already-started visits can be retimed too (admin reconciliation); every edit
// is audited (who, before/after, reason) by the backend. Drives both the
// drawer (form vs read-only) and which right-click quick actions are offered.
const isEditable = (v) => v.status !== 'cancelled';

// Legend — each dot's colour matches exactly what the block renders for that
// state, so a block on the grid can always be read against the key.
const LEGEND = [
  ['Scheduled', CHIP.neutral.dot], ['On shift', CHIP.active.dot], ['Late', CHIP.warn.dot],
  ['Missed', CHIP.danger.dot], ['Completed', CHIP.success.dot],
  ['Unfilled', 'var(--d-unfilled-ink)'], ['Cancelled', 'var(--d-faint)'],
];

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
  const control = { ...s('width:100%;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:10px 13px;font-size:13px;font-weight:500;color:var(--d-ink);outline:none;resize:vertical'), fontFamily: 'inherit' };
  return (
    <div onClick={onClose} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:440px;background:var(--d-card);border-radius:22px;padding:22px 24px;display:flex;flex-direction:column;gap:14px')}>
        <div style={s('font-size:17px;font-weight:700;color:var(--d-ink);letter-spacing:-0.2px')}>{dialog.title}</div>
        {dialog.body && <div style={s('font-size:13px;font-weight:500;color:var(--d-ink2);line-height:1.5')}>{dialog.body}</div>}
        {dialog.needReason && (
          <div style={s('display:flex;flex-direction:column;gap:6px')}>
            <span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>{dialog.reasonLabel || 'Reason'} <span style={s('color:var(--d-danger-ink)')}>*</span></span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Kept in the audit trail with your name and time" style={control} />
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

/* ---------- one visit block inside a grid cell ---------- */
function VisitBlock({ v, view, selected, onOpen, onMenu }) {
  const short = isShort(v);
  const cancelled = v.status === 'cancelled';
  const c = chipFor(v);
  const carer = v.assignments?.[0]?.employee;
  const primary = view === 'client'
    ? (carer ? fullName(carer) : 'Unfilled')
    : fullName(v.service_user);
  // Solid block, white text. Unfilled = orange, cancelled = grey + struck, else
  // Main's soft-card style with the distinct colours: unfilled = soft orange,
  // cancelled = faded grey + struck, else the status chip.
  const bg = cancelled ? 'var(--d-panel)' : short ? 'var(--d-unfilled-bg)' : c.bg;
  const ink = cancelled ? 'var(--d-faint)' : short ? 'var(--d-unfilled-ink)' : c.ink;
  const border = '1px solid transparent';
  // Open the action menu anchored to the circle itself (not the mouse) so it
  // works the same for touch and mouse — there is no right-click on the rota.
  const openMenu = (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); onMenu({ x: r.right, y: r.bottom, visit: v }); };
  return (
    <div style={s('position:relative')}>
      <div data-visit-block onClick={onOpen} draggable className="pressable"
        style={{
          ...s('border-radius:9px;padding:6px 8px;cursor:pointer;display:flex;flex-direction:column;gap:1px'),
          background: bg, color: ink, border, opacity: cancelled ? 0.7 : 1,
          textDecoration: cancelled ? 'line-through' : 'none',
        }}>
        <span style={s('font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{primary}{cancelled ? ' · cancelled' : ''}</span>
        <span className="d-num" style={s('font-size:10px;font-weight:600;opacity:0.85')}>
          {formatTime(v.scheduled_start)}–{formatTime(v.scheduled_end)}
          {/* Overnight visit: the end is the next day. Mark it (+1) so a block that
              reads e.g. "23:30–01:00" isn't mistaken for a same-day slot. */}
          {new Date(v.scheduled_end).toDateString() !== new Date(v.scheduled_start).toDateString() && (
            <span title="Ends the next day" style={s('margin-left:3px;opacity:0.9')}>⁺¹</span>
          )}
        </span>
      </div>
      {/* Action circle — the single control for this visit. Click it to open the
          menu (edit, assign, cancel, select for bulk action…). It also shows a
          check when the visit is selected for a bulk action. Replaces the old
          right-click menu, which nothing on touch could reach. */}
      <div onClick={openMenu} aria-label="Visit actions" title="Visit actions" className="rota-seldot"
        style={{
          ...s('position:absolute;top:-6px;right:-6px;width:17px;height:17px;border-radius:50%;border:1.5px solid var(--d-border);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.15);transition:transform .1s ease,background .12s ease'),
          background: selected ? 'var(--d-primary)' : 'var(--d-card)', color: selected ? '#fff' : 'var(--d-muted)',
        }}>
        {selected ? <Icon name="check" size={11} /> : <Icon name="dots" size={11} />}
      </div>
    </div>
  );
}

// Read-only reflection of the rules that actually apply to a visit: the geofence
// is on-site-only within a fixed 150 m for every client; grace/late thresholds
// are the one provider setting. Not editable per visit by design.
function RulesNote({ settings }) {
  return (
    <div style={s('background:var(--d-note-bg);border-radius:12px;padding:11px 14px;display:flex;flex-direction:column;gap:6px;font-size:11.5px;font-weight:500;color:var(--d-note-ink);line-height:1.45')}>
      <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="pin" size={14} />Geofence: on site only — clock-in within 150 m <span style={s('opacity:0.7')}>· enforced</span></div>
      <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="clock" size={14} />Late after {settings?.late_grace_minutes ?? '—'} min grace <span style={s('opacity:0.7')}>· provider setting</span></div>
      <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="fingerprint" size={14} />Clocked on the app (GPS); PIN tablet or manager attestation as fallbacks</div>
    </div>
  );
}

/* ---------- assign drawer (conflict-aware, real signals) ---------- */
function AssignDrawer({ visit, weekVisits, employees, serviceUsers, onClose, onAssigned, reassignFrom }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null); // { title, body } — shown in-modal
  if (!visit) return null;
  // reassignFrom = the current VisitAssignment id when moving a visit to a
  // different carer (atomic withdraw + assign); null for a fresh assignment.
  const isReassign = reassignFrom != null;

  const client = serviceUsers.find((c) => c.id === visit.service_user?.id);
  const regulars = new Set((client?.carers ?? []).map((n) => n.toLowerCase()));

  // Real conflict: does this carer already have a visit that overlaps in time?
  // Compared on ABSOLUTE timestamps, not minute-of-day — a minute-of-day compare
  // breaks across midnight (23:30 reads as "after" a 01:00 that's really the next
  // day), so an overnight visit could hide a genuine double-booking. Standard
  // interval overlap: aStart < bEnd && bStart < aEnd.
  const start = new Date(visit.scheduled_start).getTime();
  const end = new Date(visit.scheduled_end).getTime();
  const conflictFor = (empId) => {
    const clash = weekVisits.find((o) => o.id !== visit.id
      && (o.assignments ?? []).some((a) => a.employee?.id === empId)
      && new Date(o.scheduled_start).getTime() < end
      && start < new Date(o.scheduled_end).getTime());
    return clash ? `Double-booked with ${fullName(clash.service_user)} ${formatTime(clash.scheduled_start)}` : null;
  };

  const ranked = employees.filter((e) => e.active)
    .filter((e) => { const q = query.trim().toLowerCase(); return !q || `${e.full_name} ${e.employee_reference ?? ''}`.toLowerCase().includes(q); })
    .map((e) => ({ e, regular: regulars.has((e.full_name ?? '').toLowerCase()), conflict: conflictFor(e.id) }))
    .sort((a, b) => (Number(!!a.conflict) - Number(!!b.conflict)) || (Number(b.regular) - Number(a.regular)) || a.e.full_name.localeCompare(b.e.full_name));

  async function assign(e) {
    setBusyId(e.id);
    try {
      const res = isReassign
        ? await reassignAssignment({ assignmentId: reassignFrom, employeeId: e.id })
        : await assignEmployee({ visitId: visit.id, employeeId: e.id });
      const w = res.warnings ?? [];
      const verb = isReassign ? 'reassigned to' : 'assigned to';
      if (w.length) toast.warn(`Visit ${verb} ${e.first_name}. ${w.map((x) => x.message ?? x).join('. ')}`);
      else toast.success(`Visit ${verb} ${e.full_name}`);
      onAssigned(); onClose();
    } catch (err) {
      const c = err.data?.conflict;
      const when = c ? `${formatDateFull(c.scheduled_start, { weekday: 'short', year: undefined })}, ${formatTime(c.scheduled_start)}–${formatTime(c.scheduled_end)}` : null;
      if (err.message === 'carer_unavailable') {
        setError({ title: 'This carer already has a shift then', body: `${e.full_name} is booked with ${c?.service_user ?? 'another client'} at ${when}. A carer can't be in two places at once — pick someone else or reassign that shift first.` });
      } else if (err.message === 'client_unavailable') {
        setError({ title: 'The client already has a carer then', body: `${fullName(visit.service_user)} is already being visited at ${when}. One client, one carer at a time.` });
      } else {
        setError({ title: isReassign ? 'Could not reassign the visit' : 'Could not assign that carer', body: err.message || 'Please try again.' });
      }
    } finally { setBusyId(null); }
  }

  return (
    <Modal title={`${isReassign ? 'Reassign' : 'Assign carer'} — ${fullName(visit.service_user)}`}
      subtitle={`${formatDateFull(visit.scheduled_start, { weekday: 'long', year: undefined })} · ${formatTimeRange(visit.scheduled_start, visit.scheduled_end)}`}
      onClose={onClose}>
      <div style={s('padding:16px 22px 0')}>
        {error && (
          <div style={s('background:var(--d-danger-bg);border:1px solid var(--d-danger-bg2);border-radius:16px;padding:13px 15px;margin-bottom:14px;display:flex;gap:11px;align-items:flex-start')}>
            <div style={s('width:30px;height:30px;border-radius:9px;background:var(--d-danger-bg2);color:var(--d-danger-ink);display:flex;align-items:center;justify-content:center;flex:none')}><Icon name="alert" size={16} /></div>
            <div style={s('flex:1;min-width:0')}>
              <div style={s('font-size:13px;font-weight:700;color:var(--d-danger-ink)')}>{error.title}</div>
              <div style={s('font-size:12px;font-weight:500;color:var(--d-danger-ink);opacity:0.9;line-height:1.5;margin-top:2px')}>{error.body}</div>
            </div>
            <div onClick={() => setError(null)} className="hv" style={{ ...s('width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-danger-ink);flex:none'), '--hbg': 'var(--d-danger-bg2)' }}><Icon name="close" size={14} /></div>
          </div>
        )}
        <div style={s('background:var(--d-panel);border-radius:16px;padding:13px 15px')}>
          <div style={s('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--d-muted)')}>Visit</div>
          <div style={s('font-size:14px;font-weight:700;color:var(--d-ink);margin-top:3px')}>{fullName(visit.service_user)}</div>
          <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);margin-top:2px;display:flex;align-items:center;gap:5px')}><Icon name="pin" size={13} />{[visit.service_user?.address_line1, visit.service_user?.postcode].filter(Boolean).join(', ')}</div>
        </div>
        <div style={s('height:44px;background:var(--d-field);border:1.5px solid var(--d-border);border-radius:22px;display:flex;align-items:center;gap:9px;padding:0 16px;margin-top:14px')}>
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees by name or reference" autoFocus style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
        </div>
        <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);margin:16px 0 8px')}>Suggested carers</div>
      </div>
      <div style={s('flex:1;overflow-y:auto;padding:0 22px 20px;display:flex;flex-direction:column;gap:8px')}>
        {ranked.length === 0 ? (
          <div style={s('padding:26px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>No employees match that search.</div>
        ) : ranked.slice(0, 12).map(({ e, regular, conflict }) => (
          <button key={e.id} type="button" disabled={!!conflict}
            onClick={() => (busyId || conflict ? null : assign(e))}
            title={conflict || undefined}
            style={{ ...s('width:100%;text-align:left;border-radius:16px;padding:12px 14px;background:var(--d-panel);border:1px solid var(--d-border)'), cursor: conflict ? 'not-allowed' : 'pointer', opacity: conflict ? 0.55 : (busyId === e.id ? 0.6 : 1), fontFamily: 'inherit' }}>
            <div style={s('display:flex;align-items:center;gap:11px')}>
              <Avatar initials={inits(e)} size="sm" />
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{e.full_name}</div>
                <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{e.hours_this_week != null ? `${e.hours_this_week}h this week` : (e.role === 'senior_carer' ? 'Senior carer' : 'Carer')}{e.punctuality != null ? ` · ${e.punctuality}% on time` : ''}</div>
              </div>
              <div style={s('display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none')}>
                {regular && <Tag tone="primary">Regular carer</Tag>}
                {conflict ? <Tag tone="danger">Conflict</Tag> : <Tag tone="success">Free</Tag>}
              </div>
            </div>
            {conflict && <div style={s('font-size:11.5px;font-weight:500;color:var(--d-danger-ink);margin-top:7px;padding-left:43px')}>{conflict}</div>}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------- create-visit drawer (real fields only) ---------- */
function CreateVisitDrawer({ preset, view, serviceUsers, employees, settings, weekMonday, onClose, onCreated }) {
  const toast = useToast();
  // The modal takes its shape from the tab you're on. On the carer grouping it's
  // carer-first: pick the carer, then the client to visit, and it creates + assigns
  // in one go. On the client grouping it's client-first and leaves the visit
  // unfilled (draft) for a carer to be assigned later.
  const byCarer = view === 'carer';
  const activeCarers = (employees ?? []).filter((e) => e.active);
  const [clientId, setClientId] = useState(preset?.clientId ?? serviceUsers[0]?.id ?? '');
  const [carerId, setCarerId] = useState(preset?.carerId ?? '');
  const [day, setDay] = useState(preset?.day ?? 0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [busy, setBusy] = useState(false);
  if (!preset) return null;
  const client = serviceUsers.find((c) => c.id === Number(clientId));
  const carer = activeCarers.find((e) => e.id === Number(carerId));

  // The single source of truth for the visit's start/end DATES. Both the save
  // and the on-screen summary use it, so what you see is exactly what's saved.
  // Overnight: any end time-of-day at or before the start (i.e. after 23:59 the
  // clock wraps) is the NEXT calendar day — 22:00 -> 02:00 is a 4h overnight
  // visit, not a negative one. The end date rolls forward a day automatically.
  const resolveWindow = () => {
    // The picked time is UK wall-clock time — care happens in the UK, so "09:00"
    // means 09:00 in London no matter where the admin is (e.g. Kenya). ukTime
    // interprets the picked time as Europe/London and returns the correct UTC
    // instant. Overnight: end at/before start -> next day.
    const base = new Date(weekMonday); base.setDate(base.getDate() + Number(day));
    const startDate = ukTime(base, start);
    let endDate = ukTime(base, end);
    if (endDate.getTime() <= startDate.getTime()) endDate = ukTime(base, end, 1);
    const overnight = end <= start;
    return { startDate, endDate, overnight };
  };
  const { startDate: previewStart, endDate: previewEnd, overnight } = resolveWindow();
  // Show the preview in UK time (with a UK/GMT/BST hint) so what the admin sees
  // matches what's saved — not their own local zone.
  const fmtDateTime = (d) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', timeZoneName: 'short' });
  const durationMin = Math.round((previewEnd - previewStart) / 60000);
  const durationLabel = `${Math.floor(durationMin / 60)}h${durationMin % 60 ? ` ${durationMin % 60}m` : ''}`;

  async function save() {
    if (!clientId) { toast.error('Pick a client'); return; }
    if (byCarer && !carerId) { toast.error('Pick a carer'); return; }
    const { startDate, endDate } = resolveWindow();
    if (startDate.getTime() < Date.now()) { toast.error("You can't create a visit in the past — pick a future date and time."); return; }
    if (endDate.getTime() - startDate.getTime() < 15 * 60000) { toast.error('A visit must be at least 15 minutes long.'); return; }
    setBusy(true);
    try {
      const created = await createVisit({ service_user_id: Number(clientId), scheduled_start: startDate.toISOString(), scheduled_end: endDate.toISOString() });
      // Carer grouping: assign the chosen carer straight away so the block lands
      // in their row, not the Unassigned one. Creation succeeded either way — if
      // the assign fails, keep the draft and say what happened.
      if (byCarer && carer) {
        try {
          await assignEmployee({ visitId: created.id, employeeId: carer.id });
          toast.success(`Visit created for ${fullName(client)} — ${fullName(carer)} assigned`);
        } catch (assignErr) {
          toast.error(`Visit created, but ${fullName(carer)} couldn't be assigned: ${assignErr.message || 'try from the visit'}`);
        }
      } else {
        toast.success(`Visit created for ${fullName(client)}`);
      }
      onCreated(); onClose();
    } catch (err) {
      const msg = err.message === 'client_overlap' ? `${fullName(client)} already has a visit at that time — one client, one visit at a time.`
        : err.message === 'visit_in_past' ? "You can't create a visit in the past."
        : (err.message || 'Could not create the visit');
      toast.error(msg);
    } finally { setBusy(false); }
  }

  const field = s('display:flex;flex-direction:column;gap:6px');
  const label = s('font-size:11.5px;font-weight:700;color:var(--d-ink2)');
  const control = { ...s('height:42px;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Modal title={byCarer ? 'New visit for a carer' : 'New visit'}
      subtitle={byCarer ? 'Pick the carer and the client to visit — it goes straight onto their rota as a draft.' : 'Add a one-off visit to the rota. It starts as a draft until you publish.'} onClose={onClose}
      footer={<div style={s('display:flex;justify-content:flex-end;gap:8px')}><span data-tour="rota-create-cancel"><Button variant="ghost" onClick={onClose}>Cancel</Button></span><Button variant="primary" icon="check" onClick={busy ? undefined : save}>{busy ? 'Creating…' : 'Create visit'}</Button></div>}>
      <div data-tour="rota-create-fields" style={s('padding:18px 22px;display:flex;flex-direction:column;gap:16px')}>
        {/* Carer grouping puts the carer first — that's the row you're adding to. */}
        {byCarer && (
          <div style={field}><span style={label}>Carer</span>
            <select value={carerId} onChange={(e) => setCarerId(e.target.value)} style={control}>
              <option value="">Select a carer…</option>
              {activeCarers.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
            </select>
          </div>
        )}
        <div style={field}><span style={label}>Client</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={control}>
            {serviceUsers.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
          </select>
        </div>
        <div style={field}><span style={label}>Day</span>
          <select value={day} onChange={(e) => setDay(e.target.value)} style={control}>
            {days.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
          <div style={field}><span style={label}>Start</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={control} /></div>
          <div style={field}><span style={label}>End</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={control} /></div>
        </div>
        {/* Explicit resolved window so the coordinator sees the real start and
            end DATE + time — critical for an overnight visit, where the end is
            the next day. This is exactly what gets saved. */}
        <div style={{ ...s('display:flex;flex-direction:column;gap:5px;border-radius:10px;padding:9px 12px'), background: overnight ? 'var(--d-note-bg)' : 'var(--d-panel)' }}>
          <div style={s('display:flex;justify-content:space-between;gap:12px;font-size:12px;font-weight:600;color:var(--d-ink)')}>
            <span style={s('color:var(--d-muted)')}>Starts</span><span className="d-num">{fmtDateTime(previewStart)}</span>
          </div>
          <div style={s('display:flex;justify-content:space-between;gap:12px;font-size:12px;font-weight:600;color:var(--d-ink)')}>
            <span style={s('color:var(--d-muted)')}>Ends</span><span className="d-num">{fmtDateTime(previewEnd)}</span>
          </div>
          <div style={s('display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--d-note-ink);margin-top:1px')}>
            <Icon name="clock" size={12} />{durationLabel}{overnight ? ' · overnight — ends the next day' : ''}
          </div>
        </div>
        <div style={s('display:flex;flex-direction:column;gap:6px')}><span style={label}>Rules that will apply</span><RulesNote settings={settings} /></div>
      </div>
    </Modal>
  );
}

/* ---------- what the carer actually did on this visit ---------- */
function VisitDelivery({ delivery }) {
  if (delivery === undefined) return <div style={s('font-size:12px;font-weight:500;color:var(--d-muted)')}>Loading care record…</div>;
  if (delivery === null) return null; // couldn't load — stay quiet rather than shout an error in the drawer
  const tasks = (delivery.assignments ?? []).flatMap((a) => a.tasks ?? []);
  const notes = (delivery.assignments ?? []).flatMap((a) => (a.notes ?? []).map((n) => ({ ...n, carer: a.employee?.name })));
  const done = tasks.filter((t) => t.done).length;
  if (tasks.length === 0 && notes.length === 0) {
    return <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);background:var(--d-panel);border-radius:12px;padding:12px 14px')}>No tasks or notes recorded for this visit yet.</div>;
  }
  return (
    <div style={s('display:flex;flex-direction:column;gap:12px')}>
      {tasks.length > 0 && (
        <div style={s('display:flex;flex-direction:column;gap:8px')}>
          <div style={s('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--d-muted)')}>Tasks — {done}/{tasks.length} done</div>
          {tasks.map((t) => (
            <div key={t.id} style={s('display:flex;align-items:center;gap:9px;background:var(--d-panel);border-radius:12px;padding:10px 13px')}>
              <span style={s(`width:18px;height:18px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none;background:${t.done ? 'var(--d-primary)' : 'var(--d-field)'};color:#fff`)}>{t.done && <Icon name="check" size={12} />}</span>
              <span style={s(`font-size:13px;font-weight:600;color:var(--d-ink);${t.done ? '' : 'opacity:0.6'}`)}>{t.label}</span>
            </div>
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <div style={s('display:flex;flex-direction:column;gap:8px')}>
          <div style={s('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--d-muted)')}>Carer notes</div>
          {notes.map((n) => (
            <div key={n.id} style={s('background:var(--d-note-bg);border-radius:12px;padding:11px 14px;display:flex;flex-direction:column;gap:5px')}>
              <div style={s('font-size:13px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>{n.body}</div>
              <div style={s('font-size:11px;font-weight:600;color:var(--d-muted)')}>{n.author_name ?? n.carer ?? 'Unknown'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- filled-visit editor drawer (retime + real actions) ---------- */
function VisitDetailDrawer({ visit, settings, onClose, onChanged }) {
  const toast = useToast();
  const [start, setStart] = useState(formatTime(visit?.scheduled_start));
  const [end, setEnd] = useState(formatTime(visit?.scheduled_end));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  // Care-delivery record for this visit (care plan + tasks done + carer notes).
  const [delivery, setDelivery] = useState(undefined); // undefined = loading, null = failed
  useEffect(() => {
    if (!visit?.id) return undefined;
    let active = true;
    setDelivery(undefined);
    getVisit(visit.id).then((d) => active && setDelivery(d)).catch(() => active && setDelivery(null));
    return () => { active = false; };
  }, [visit?.id]);
  if (!visit) return null;
  const a = visit.assignments?.[0];
  const started = (visit.assignments ?? []).some((x) => x.actual_start);
  const tone = { neutral: 'muted', warn: 'warning', active: 'info' }[LIFECYCLE_TONE[stateOf(visit)]] ?? LIFECYCLE_TONE[stateOf(visit)];

  async function publish() { try { await publishVisit(visit.id); toast.success('Visit published'); onChanged(); onClose(); } catch (e) { toast.error(e.message || 'Could not publish'); } }
  async function save() {
    if (!reason.trim()) { toast.error('Add a reason — it goes in the audit trail'); return; }
    // Keep the visit's original UK calendar day, and set the picked times as UK
    // wall-clock (not the admin's local zone). The day parts come from the visit's
    // UK date so a Kenya admin editing near midnight doesn't shift the day.
    const ukParts = new Date(visit.scheduled_start).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }).split('-').map(Number);
    const base = new Date(ukParts[0], ukParts[1] - 1, ukParts[2]);
    const mk = (t) => ukTime(base, t).toISOString();
    setBusy(true);
    try {
      await editVisit(visit.id, { scheduled_start: mk(start), scheduled_end: mk(end), reason: reason.trim() });
      toast.success('Visit retimed — change logged to the audit trail');
      onChanged(); onClose();
    } catch (e) { toast.error(e.message || 'Could not retime the visit'); } finally { setBusy(false); }
  }

  const label = s('font-size:11.5px;font-weight:700;color:var(--d-ink2)');
  const control = { ...s('height:42px;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };

  // Only a cancelled visit is read-only: the drawer shows the record but no
  // edit form or save. Past and started visits can still be retimed here for
  // reconciliation — the backend audits every change (who, before/after, why).
  const editable = isEditable(visit);

  return (
    <Modal title={`${editable ? 'Edit' : 'Visit'} — ${fullName(visit.service_user)}`} subtitle={formatDateFull(visit.scheduled_start, { weekday: 'long', year: undefined })} onClose={onClose}
      footer={editable ? (
        <div style={s('display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap')}>
          {visit.status === 'draft' && <Button icon="send" onClick={publish}>Publish</Button>}
          <Button variant="primary" icon="check" onClick={busy ? undefined : save}>{busy ? 'Saving…' : 'Save changes'}</Button>
        </div>
      ) : null}>
      <div style={s('padding:18px 22px;display:flex;flex-direction:column;gap:15px')}>
        <div style={s('display:flex;align-items:center;gap:8px')}>
          <Tag tone={tone}>{LIFECYCLE_LABELS[stateOf(visit)]}</Tag>
          {visit.status === 'draft' && <Tag tone="muted">Draft</Tag>}
        </div>
        <div style={s('background:var(--d-panel);border-radius:14px;padding:13px 15px')}>
          <div style={s('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--d-muted)')}>Carer</div>
          <div style={s('font-size:13.5px;font-weight:700;color:var(--d-ink);margin-top:3px')}>{a ? fullName(a.employee) : 'Unassigned'}</div>
          <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);margin-top:6px')}>{[visit.service_user?.address_line1, visit.service_user?.postcode].filter(Boolean).join(', ')}</div>
        </div>
        <RulesNote settings={settings} />
        <VisitDelivery delivery={delivery} />
        {!editable ? (
          <div style={s('font-size:12px;font-weight:500;color:var(--d-note-ink);background:var(--d-note-bg);border-radius:12px;padding:12px 14px;line-height:1.5')}>
            This visit was cancelled. Its record is read-only.
          </div>
        ) : (
          <>
            {started && (
              <div style={s('font-size:12px;font-weight:500;color:var(--d-note-ink);background:var(--d-note-bg);border-radius:12px;padding:12px 14px;line-height:1.5')}>
                The carer already clocked in — retiming here changes the schedule, not the clock record. Use a clock correction to fix the actual clocked time.
              </div>
            )}
            <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
              <div style={s('display:flex;flex-direction:column;gap:6px')}><span style={label}>Start</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={control} /></div>
              <div style={s('display:flex;flex-direction:column;gap:6px')}><span style={label}>End</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={control} /></div>
            </div>
            <div style={s('display:flex;flex-direction:column;gap:6px')}>
              <span style={label}>Reason for change or cancellation <span style={s('color:var(--d-danger-ink)')}>*</span></span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Client asked for a later call, or client in hospital" style={{ ...control, ...s('height:auto;padding:10px 13px;resize:vertical') }} />
              <span style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>Required to retime or cancel — stored in the audit trail with your name and time.</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ============================== page ============================== */
export default function RotaPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [weekStart, setWeekStart] = useState(() => weekOf().monday);
  const [visits, setVisits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [serviceUsers, setServiceUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('client');
  const [layout, setLayout] = useState('grid'); // 'grid' | 'list' — how the week is drawn, independent of the carer/client grouping above
  const [assigning, setAssigning] = useState(null);
  const [creating, setCreating] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reassigning, setReassigning] = useState(null); // { visit, assignmentId }
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();

  const range = useMemo(() => weekOf(weekStart), [weekStart]);

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

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(range.monday); d.setDate(d.getDate() + i);
    return { date: d, label: d.toLocaleDateString('en-GB', { weekday: 'short' }), num: d.getDate(), today: d.toDateString() === new Date().toDateString() };
  }), [range.monday]);

  const rows = useMemo(() => {
    if (view === 'carer') {
      const carerRows = [...employees].filter((e) => e.active).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((e) => ({
        id: `e${e.id}`, title: e.full_name, initials: inits(e),
        sub: `${e.hours_this_week ?? 0}h${e.contracted_hours_per_week ? ` / ${e.contracted_hours_per_week}h` : ''}${e.punctuality != null ? ` · ${e.punctuality}% on time` : ''}`,
        cell: (d) => visits.filter((v) => (v.assignments ?? []).some((a) => a.employee?.id === e.id) && sameDay(v.scheduled_start, d)),
      }));
      // Visits with no active carer match no carer row, so surface them in a top
      // "Unassigned" row — this includes cancelled visits (which lost their carer
      // on cancel) so they still SHOW on the board, matching the DB. The count in
      // the label only reflects the live ones that actually still need a carer.
      const noCarer = visits.filter((v) => !(v.assignments ?? []).some((a) => a.employee?.id));
      if (noCarer.length === 0) return carerRows;
      const needCarer = noCarer.filter((v) => v.status !== 'cancelled').length;
      return [
        {
          id: 'unassigned', title: 'Unassigned', initials: '—',
          sub: needCarer > 0 ? `${needCarer} visit${needCarer === 1 ? '' : 's'} need a carer` : 'Cancelled visits',
          cell: (d) => noCarer.filter((v) => sameDay(v.scheduled_start, d)),
        },
        ...carerRows,
      ];
    }
    return [...serviceUsers].filter((c) => c.active).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((c) => ({
      id: `c${c.id}`, title: c.full_name, initials: inits(c),
      sub: `${c.visits_per_week ?? 0} visits/wk${c.city ? ` · ${c.city}` : ''}`,
      cell: (d) => visits.filter((v) => v.service_user?.id === c.id && sameDay(v.scheduled_start, d)),
    }));
  }, [view, employees, serviceUsers, visits]);

  // List layout: every visit in the week, one row each, earliest first — an
  // agenda rather than a grid. Independent of `view` (carer/client grouping
  // only matters to the grid's rows/columns).
  // Most recent first — the list reads newest-to-oldest so today's and upcoming
  // visits sit at the top rather than being buried under the start of the week.
  const listRows = useMemo(
    () => [...visits].sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start)),
    [visits],
  );
  // Client-side pagination for the list layout so a long range doesn't render
  // every row at once. Back to page 1 whenever the underlying set changes.
  const LIST_PER_PAGE = 25;
  const [listPage, setListPage] = useState(1);
  useEffect(() => { setListPage(1); }, [listRows.length]);
  const pagedRows = useMemo(
    () => listRows.slice((listPage - 1) * LIST_PER_PAGE, listPage * LIST_PER_PAGE),
    [listRows, listPage],
  );

  const drafts = useMemo(() => visits.filter((v) => v.status === 'draft'), [visits]);

  const move = (w) => { const d = new Date(range.monday); d.setDate(d.getDate() + w * 7); setWeekStart(d); };
  const toggleSel = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const openBlock = (v) => (isShort(v) ? setAssigning(v) : setDetail(v));

  // Visit action menu, opened from the block's action circle. Left-click the
  // block still opens the drawer; the circle opens these fast actions (assign /
  // reassign / cancel / delete / remove carer / select for bulk).
  const [menu, setMenu] = useState(null); // { x, y, visit }
  const [confirm, setConfirm] = useState(null); // ConfirmDialog config

  function quickCancel(v) {
    setConfirm({
      title: 'Cancel this visit?',
      body: 'The visit is marked cancelled and the carer is freed. Its record is kept.',
      confirmLabel: 'Cancel visit', danger: true, needReason: true, reasonLabel: 'Reason for cancelling',
      onConfirm: async (reason) => {
        try { await cancelVisit(v.id, reason); toast.success('Visit cancelled — carer freed'); await load(); }
        catch (e) { toast.error(e.message || 'Could not cancel the visit'); }
      },
    });
  }
  function quickDelete(v) {
    setConfirm({
      title: 'Delete this visit for good?',
      body: 'It leaves the rota and the carer is freed. Use Cancel instead if it may need a record — deletion is refused once a carer has clocked in.',
      confirmLabel: 'Delete visit', danger: true,
      onConfirm: async () => {
        try { await deleteVisit(v.id); toast.success('Visit deleted — carer freed'); await load(); }
        catch (e) { toast.error(e.message === 'visit_started' ? 'A carer has clocked in — cancel it instead so the record is kept.' : (e.message || 'Could not delete the visit')); }
      },
    });
  }
  async function quickWithdraw(v) {
    const a = v.assignments?.[0];
    if (!a) return;
    try { await withdrawAssignment(a.id); toast.info('Carer removed from that visit'); await load(); }
    catch (e) { toast.error(e.message || 'Could not remove the carer'); }
  }

  // Menu items for a visit, opened from the block's action circle (there is no
  // right-click on the rota — this is the single control). A past/started/
  // cancelled visit only offers "View details" — its record is read-only.
  function menuItems(v) {
    const a = v.assignments?.[0];
    const isSel = selected.includes(v.id);
    const view = { label: 'View details', icon: 'note', onClick: () => (isShort(v) ? setAssigning(v) : setDetail(v)) };
    // Select for bulk action lives here now that the circle is the menu trigger.
    const select = { label: isSel ? 'Deselect' : 'Select for bulk action', icon: 'check', onClick: () => toggleSel(v.id) };
    if (!canManage || !isEditable(v)) return [view, null, select];
    const items = [view, null];
    if (a) items.push({ label: 'Reassign carer', icon: 'user', onClick: () => setReassigning({ visit: v, assignmentId: a.id }) });
    else items.push({ label: 'Assign carer', icon: 'user', onClick: () => setAssigning(v) });
    if (a) items.push({ label: 'Remove carer', icon: 'close', onClick: () => quickWithdraw(v) });
    // Cover — send an unfilled visit to the cover board for carers to claim.
    if (isShort(v)) items.push({ label: 'Find cover', icon: 'refresh', onClick: () => navigate('/cover') });
    items.push(null, select, null);
    items.push({ label: 'Cancel visit', icon: 'close', danger: true, onClick: () => quickCancel(v) });
    items.push({ label: 'Delete visit', icon: 'close', danger: true, onClick: () => quickDelete(v) });
    return items;
  }

  // Auto-generate the upcoming week's visits from the care packages. Always the
  // NEXT Mon–Sun from today (not the viewed week), then jump the view to it.
  async function handleGenerateNextWeek() {
    setBusy(true);
    try {
      const nextMon = new Date(range.monday);
      // move to the Monday of next week relative to today
      const todayMon = weekOf(new Date()).monday;
      nextMon.setTime(new Date(todayMon).getTime());
      nextMon.setDate(nextMon.getDate() + 7);
      const nextSun = new Date(nextMon); nextSun.setDate(nextSun.getDate() + 6);
      const r = await generateVisits({ from: isoDate(nextMon), to: isoDate(nextSun) });
      toast.success(`${r.created} visit${r.created === 1 ? '' : 's'} generated for next week`);
      setWeekStart(nextMon);
      await load();
    } catch (e) { toast.error(e.message || 'Could not generate next week'); } finally { setBusy(false); }
  }
  async function handlePublishAll() {
    if (drafts.length === 0) { toast.info('No draft visits to publish'); return; }
    setBusy(true);
    try { await Promise.all(drafts.map((v) => publishVisit(v.id))); toast.success(`Rota published — ${drafts.length} visit${drafts.length === 1 ? '' : 's'} now visible to carers`); await load(); }
    catch (e) { toast.error(e.message || 'Some visits could not be published'); } finally { setBusy(false); }
  }

  const selectedVisits = () => visits.filter((v) => selected.includes(v.id));
  const notStarted = (v) => !(v.assignments ?? []).some((a) => a.actual_start);
  async function bulkPublish() {
    const d = selectedVisits().filter((v) => v.status === 'draft');
    if (!d.length) { toast.info('None of the selected visits are drafts'); return; }
    try { await Promise.all(d.map((v) => publishVisit(v.id))); toast.success(`${d.length} visit${d.length === 1 ? '' : 's'} published`); setSelected([]); await load(); }
    catch (e) { toast.error(e.message || 'Some could not be published'); }
  }
  async function bulkShift(mins) {
    const editable = selectedVisits().filter(notStarted);
    if (!editable.length) { toast.info('Selected visits have already started — cannot retime'); return; }
    const shift = (iso) => new Date(new Date(iso).getTime() + mins * 60000).toISOString();
    try {
      await Promise.all(editable.map((v) => editVisit(v.id, { scheduled_start: shift(v.scheduled_start), scheduled_end: shift(v.scheduled_end), reason: `Bulk time shift ${mins > 0 ? '+' : ''}${mins} min from the rota` })));
      toast.success(`${editable.length} visit${editable.length === 1 ? '' : 's'} shifted ${mins > 0 ? '+' : ''}${mins} min`); setSelected([]); await load();
    } catch (e) { toast.error(e.message || 'Some visits could not be shifted'); }
  }
  async function bulkCopyNextWeek() {
    const sel = selectedVisits();
    const plus7 = (iso) => new Date(new Date(iso).getTime() + 7 * 86400000).toISOString();
    try {
      await Promise.all(sel.map((v) => createVisit({ service_user_id: v.service_user?.id, scheduled_start: plus7(v.scheduled_start), scheduled_end: plus7(v.scheduled_end) })));
      toast.success(`${sel.length} visit${sel.length === 1 ? '' : 's'} copied to next week as drafts`); setSelected([]);
    } catch (e) { toast.error(e.message || 'Some visits could not be copied'); }
  }

  const GRID = '188px repeat(7, minmax(128px, 1fr))';
  const circleBtn = { ...s('width:36px;height:36px;border-radius:50%;background:var(--d-card);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2);flex:none'), '--hbg': 'var(--d-card-hover)' };
  const viewTabs = [{ key: 'carer', label: 'By carer', icon: 'users', count: employees.filter((e) => e.active).length }, { key: 'client', label: 'By client', icon: 'user', count: serviceUsers.filter((c) => c.active).length }];

  return (
    <div style={s('display:flex;flex-direction:column;gap:14px')}>
      {/* Page actions */}
      {canManage && (
        <div style={s('display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end')}>
          <span data-tour="rota-generate"><Button icon="sync" onClick={busy ? undefined : handleGenerateNextWeek}>{busy ? 'Working…' : 'Generate next week'}</Button></span>
          <Button icon="send" onClick={busy ? undefined : handlePublishAll}>{drafts.length ? `Publish rota (${drafts.length})` : 'Publish rota'}</Button>
          <ExportButton label="Export rota" title="Export rota" subtitle="Choose a file format. The week on screen is exported."
            onExport={async (type) => { try { await exportRota(range.from, range.to, type); toast.success(`Rota ${type.toUpperCase()} downloaded`); } catch (e) { toast.error(e.message || 'Export failed'); return false; } }} />
          <span data-tour="rota-add" style={s('display:inline-flex;align-items:center;gap:6px')}><Button variant="primary" icon="plus" onClick={() => setCreating({ day: 0 })}>Add visit</Button><InfoHint below text={view === 'carer' ? 'Add a one-off visit for a carer: choose the carer, the client to visit, the day and the time, then Create. It goes onto their rota as a draft until you publish.' : 'Add a one-off visit: choose the client, the day and the start/end time, then Create. It starts as a draft until you publish. One client can\'t be double-booked at the same time.'} /></span>
        </div>
      )}

      {/* Row 1 — view controls on the left (what am I looking at), week
          navigation on the right (which week). */}
      <div style={s('display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap')}>
        <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
          <span data-tour="rota-view"><SegTabs tabs={viewTabs} active={view} onSelect={setView} /></span>
          <div data-tour="rota-layout" style={s('display:inline-flex;align-items:center;gap:2px;background:var(--d-panel);border-radius:12px;padding:3px')}>
            {[{ key: 'grid', icon: 'calendar', label: 'Grid' }, { key: 'list', icon: 'menu', label: 'List' }].map((o) => (
              <div key={o.key} onClick={() => setLayout(o.key)} title={`${o.label} view`}
                style={{ ...s('display:flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:9px;cursor:pointer;font-size:12px;font-weight:700'), background: layout === o.key ? 'var(--d-card)' : 'transparent', color: layout === o.key ? 'var(--d-ink)' : 'var(--d-muted)' }}>
                <Icon name={o.icon} size={14} />{o.label}
              </div>
            ))}
          </div>
        </div>
        <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
          <div data-tour="rota-week" style={s('display:flex;align-items:center;gap:8px')}>
            <div className="hv" onClick={() => move(-1)} style={circleBtn}><Icon name="chevronLeft" size={17} /></div>
            <span style={s('font-size:13.5px;font-weight:700;color:var(--d-ink);min-width:132px;text-align:center')}>{range.monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {range.sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <div className="hv" onClick={() => move(1)} style={circleBtn}><Icon name="chevronRight" size={17} /></div>
          </div>
          <div onClick={() => setWeekStart(weekOf().monday)} className="hv" style={{ ...s('height:34px;border-radius:17px;background:var(--d-panel);display:flex;align-items:center;padding:0 14px;font-size:12.5px;font-weight:700;color:var(--d-ink2);cursor:pointer'), '--hbg': 'var(--d-sage)' }}>This week</div>
          <div onClick={() => load()} className="hv tip" data-tip="Refresh the rota" style={{ ...s('height:34px;width:34px;border-radius:17px;background:var(--d-panel);display:flex;align-items:center;justify-content:center;color:var(--d-ink2);cursor:pointer'), '--hbg': 'var(--d-sage)' }}><Icon name="refresh" size={16} /></div>
        </div>
      </div>

      {/* Row 2 — publish status on the left, colour legend on the right. */}
      <div style={s('display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap')}>
        <Tag tone={drafts.length ? 'warning' : 'success'}>{drafts.length ? `Draft — ${drafts.length} unpublished` : 'Published'}</Tag>
        <div style={s('display:flex;flex-wrap:wrap;gap:12px;font-size:11px;font-weight:600;color:var(--d-muted)')}>
          {LEGEND.map(([l, dot]) => (
            <span key={l} style={s('display:inline-flex;align-items:center;gap:5px')}><span style={{ ...s('width:8px;height:8px;border-radius:50%'), background: dot }} />{l}</span>
          ))}
        </div>
      </div>

      <p style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin:0')}>Click a block to open it — an unfilled visit opens the assign panel, a filled one its detail. Use the dot on a block to select visits for a bulk action.</p>

      {loading ? <Spinner /> : layout === 'list' ? (
        /* List — every visit in the week, one row each, earliest first. Same
           behaviour as a grid block, just as a table row: click the row to open
           the drawer, click the action circle for the menu (which also holds
           "select for bulk action", feeding the same bulk bar). */
        <div data-tour="rota-list" style={s('background:var(--d-card);border-radius:16px;border:1px solid var(--d-border);overflow:hidden;padding:12px 14px')}>
          {listRows.length === 0 ? (
            <div style={s('padding:38px;text-align:center;font-size:13px;font-weight:600;color:var(--d-muted)')}>No visits this week.</div>
          ) : (
            <TableWrap minWidth={880}>
              <thead><tr><Th>{' '}</Th><Th>Day</Th><Th>Time</Th><Th>Client</Th><Th>Carer</Th><Th align="right">Status</Th></tr></thead>
              <tbody>
                {pagedRows.map((v) => {
                  const short = isShort(v);
                  const cancelled = v.status === 'cancelled';
                  const carer = v.assignments?.[0]?.employee;
                  return (
                    <Row key={v.id} onClick={() => openBlock(v)} selected={selected.includes(v.id)}>
                      <Td>
                        {/* Action circle — same control as the grid block: click to
                            open the menu (edit, assign, select for bulk, cancel…). */}
                        <span onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right, y: r.bottom, visit: v }); }}
                          aria-label="Visit actions" title="Visit actions"
                          style={{ ...s('display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;border:1px solid var(--d-border);cursor:pointer'), background: selected.includes(v.id) ? 'var(--d-primary)' : 'transparent', color: selected.includes(v.id) ? '#fff' : 'var(--d-muted)' }}>
                          {selected.includes(v.id) ? <Icon name="check" size={11} /> : <Icon name="dots" size={11} />}
                        </span>
                      </Td>
                      <Td mono>{formatDateFull(v.scheduled_start, { weekday: 'short', year: undefined })}</Td>
                      <Td mono>{formatTime(v.scheduled_start)}–{formatTime(v.scheduled_end)}</Td>
                      <Td><span style={{ ...s('font-weight:700;color:var(--d-ink)'), textDecoration: cancelled ? 'line-through' : 'none', opacity: cancelled ? 0.6 : 1 }}>{fullName(v.service_user)}</span></Td>
                      <Td>{carer ? fullName(carer) : <span style={s('color:var(--d-faint)')}>Unassigned</span>}</Td>
                      <Td align="right">
                        {cancelled ? <Tag tone="muted">Cancelled</Tag>
                          : short ? <Tag tone="warning">Unfilled</Tag>
                            : <Tag tone={L2TAG[LIFECYCLE_TONE[stateOf(v)]] ?? 'muted'}>{LIFECYCLE_LABELS[stateOf(v)]}</Tag>}
                      </Td>
                    </Row>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
          {listRows.length > LIST_PER_PAGE && (
            <div style={s('display:flex;justify-content:flex-end;padding:10px 2px 2px')}>
              <Pager page={listPage} perPage={LIST_PER_PAGE} total={listRows.length} onPage={setListPage} />
            </div>
          )}
        </div>
      ) : (
        /* Grid — bordered spreadsheet: sticky first column, ruled cells */
        <div data-tour="rota-grid" style={s('background:var(--d-card);border-radius:16px;border:1px solid var(--d-border);overflow:hidden')}>
          <div style={s('overflow-x:auto')}>
            <div style={{ ...s('display:grid;align-items:stretch'), gridTemplateColumns: GRID, minWidth: 1080 }}>
              <div style={s('position:sticky;left:0;z-index:3;background:var(--d-panel);border-bottom:1px solid var(--d-border);border-right:1px solid var(--d-border);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--d-muted);padding:10px 14px;display:flex;align-items:center')}>{view === 'carer' ? 'Carer' : 'Client'}</div>
              {weekDays.map((d) => (
                <div key={d.num} style={{ ...s('text-align:center;padding:7px 2px;border-bottom:1px solid var(--d-border);border-left:1px solid var(--d-border)'), background: d.today ? 'var(--d-primary-soft)' : 'var(--d-panel)' }}>
                  <div style={{ ...s('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em'), color: d.today ? 'var(--d-primary-deep)' : 'var(--d-muted)' }}>{d.label}</div>
                  <div className="d-num" style={{ ...s('font-size:14px;font-weight:700'), color: d.today ? 'var(--d-primary-deep)' : 'var(--d-ink)' }}>{d.num}</div>
                </div>
              ))}

              {rows.length === 0 ? (
                <div style={{ ...s('padding:38px;text-align:center;font-size:13px;font-weight:600;color:var(--d-muted)'), gridColumn: '1 / -1' }}>No {view === 'carer' ? 'carers' : 'clients'} to show.</div>
              ) : rows.map((row) => (
                <Fragment key={row.id}>
                  <div style={s('position:sticky;left:0;z-index:3;background:var(--d-card);border-bottom:1px solid var(--d-border);border-right:1px solid var(--d-border);display:flex;align-items:center;gap:9px;padding:8px 12px')}>
                    <Avatar initials={row.initials} size="sm" />
                    <div style={s('min-width:0')}>
                      <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.title}</div>
                      <div className="d-num" style={s('font-size:10.5px;font-weight:500;color:var(--d-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{row.sub}</div>
                    </div>
                  </div>
                  {weekDays.map((d) => {
                    const cell = row.cell(d.date);
                    return (
                      <div key={d.num} className="rota-cell" style={s('position:relative;border-bottom:1px solid var(--d-border);border-left:1px solid var(--d-border);min-height:60px;padding:5px;display:flex;flex-direction:column;gap:5px')}>
                        {cell.map((v) => <VisitBlock key={v.id} v={v} view={view} selected={selected.includes(v.id)} onOpen={() => openBlock(v)} onMenu={setMenu} />)}
                        {/* Per-row quick-add. On the client grouping it prefills the
                            client for this row; on the carer grouping it prefills the
                            carer (skip the "Unassigned" pseudo-row, which has no id). */}
                        {canManage && (view === 'client' || (view === 'carer' && row.id.startsWith('e'))) && (
                          <button type="button" aria-label="Add visit"
                            onClick={() => setCreating(view === 'carer'
                              ? { day: weekDays.indexOf(d), carerId: Number(row.id.slice(1)) }
                              : { day: weekDays.indexOf(d), clientId: Number(row.id.slice(1)) })}
                            className="rota-add" style={{ ...s('border:1px dashed var(--d-border);border-radius:8px;background:transparent;color:var(--d-muted);font-size:13px;font-weight:700;padding:1px 0;cursor:pointer;margin-top:auto'), opacity: 0 }}>+</button>
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk bar — matches the design; every action wired to a real endpoint */}
      {selected.length > 0 && (
        <div style={s('position:sticky;bottom:16px;z-index:30;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:fit-content;background:var(--d-card);border:1px solid var(--d-border);border-radius:999px;padding:7px 10px;box-shadow:0 12px 30px rgba(15,23,30,0.18)')}>
          <span className="d-num" style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);padding:0 6px')}>{selected.length} selected</span>
          <Button size="sm" icon="clock" onClick={() => bulkShift(-15)}>−15 min</Button>
          <Button size="sm" icon="clock" onClick={() => bulkShift(15)}>+15 min</Button>
          <Button size="sm" icon="sync" onClick={bulkCopyNextWeek}>Copy to next week</Button>
          <Button size="sm" icon="send" onClick={bulkPublish}>Publish selected</Button>
          <Button size="sm" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      {assigning && <AssignDrawer visit={assigning} weekVisits={visits} employees={employees} serviceUsers={serviceUsers} onClose={() => setAssigning(null)} onAssigned={load} />}
      {reassigning && <AssignDrawer visit={reassigning.visit} reassignFrom={reassigning.assignmentId} weekVisits={visits} employees={employees} serviceUsers={serviceUsers} onClose={() => setReassigning(null)} onAssigned={load} />}
      {creating && <CreateVisitDrawer preset={creating} view={view} serviceUsers={serviceUsers} employees={employees} settings={settings} weekMonday={range.monday} onClose={() => setCreating(null)} onCreated={load} />}
      {detail && <VisitDetailDrawer visit={detail} settings={settings} onClose={() => setDetail(null)} onChanged={load} />}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.visit)} onClose={() => setMenu(null)} />}
      <ConfirmDialog dialog={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
