import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  listVisits, listEmployees, listServiceUsers, getSettings,
  assignEmployee, withdrawAssignment, publishVisit, generateVisits, createVisit, editVisit, copyRota,
  exportRota,
} from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LIFECYCLE_LABELS, LIFECYCLE_TONE, formatTime, formatTimeRange, fullName, weekOf, isoDate,
} from '../api/format.js';
import { Panel, PanelTitle, Button, Tag, Avatar, SegTabs } from '../ds/console.jsx';

const isShort = (v) => (v.assignments ?? []).length < v.staff_required;
const sameDay = (iso, d) => new Date(iso).toDateString() === d.toDateString();
const inits = (p) => ((p?.first_name?.[0] ?? '') + (p?.last_name?.[0] ?? '')) || '—';
const toMin = (t) => { const [h, m] = (t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

// Lifecycle state -> chip colour, mirroring the design's lifecycleMeta.
const CHIP = {
  neutral: { bg: 'var(--d-panel)', ink: 'var(--d-ink2)', dot: 'var(--d-muted)' },
  info: { bg: 'var(--d-info-bg)', ink: 'var(--d-info-ink)', dot: 'var(--d-primary)' },
  active: { bg: 'var(--d-info-bg)', ink: 'var(--d-info-ink)', dot: 'var(--d-ok-ink)' },
  warn: { bg: 'var(--d-warn-bg)', ink: 'var(--d-warn-ink)', dot: 'var(--d-warn-dot)' },
  danger: { bg: 'var(--d-danger-bg)', ink: 'var(--d-danger-ink)', dot: 'var(--d-danger-dot)' },
  success: { bg: 'var(--d-ok-bg)', ink: 'var(--d-ok-ink)', dot: 'var(--d-ok-ink)' },
};
const stateOf = (v) => (v.assignments?.[0]?.lifecycle_state) ?? 'scheduled';
const chipFor = (v) => (isShort(v) ? null : CHIP[LIFECYCLE_TONE[stateOf(v)] ?? 'neutral']);

// Legend entries (design: scheduled / clocked-in / late / missed / unfilled).
const LEGEND = [
  ['Scheduled', CHIP.neutral.dot], ['On shift', CHIP.active.dot],
  ['Late', CHIP.warn.dot], ['Missed', CHIP.danger.dot], ['Completed', CHIP.success.dot],
];

/* ---------- one visit block inside a grid cell ---------- */
function VisitBlock({ v, view, selected, onToggle, onOpen }) {
  const short = isShort(v);
  const c = chipFor(v);
  const carer = v.assignments?.[0]?.employee;
  const primary = view === 'client'
    ? (carer ? fullName(carer) : 'Unfilled')
    : fullName(v.service_user);
  return (
    <div style={s('position:relative')}>
      <div onClick={onOpen} draggable className="pressable"
        style={{
          ...s('border-radius:9px;padding:6px 8px;cursor:pointer;display:flex;flex-direction:column;gap:1px'),
          background: short ? 'var(--d-danger-bg)' : c.bg,
          color: short ? 'var(--d-danger-ink)' : c.ink,
          border: short ? '1px dashed var(--d-danger-dot)' : '1px solid transparent',
        }}>
        <span style={s('font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{primary}</span>
        <span className="d-num" style={s('font-size:10px;font-weight:600;opacity:0.85')}>{formatTime(v.scheduled_start)}–{formatTime(v.scheduled_end)}</span>
      </div>
      <div onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="Select visit"
        style={{
          ...s('position:absolute;top:-5px;right:-5px;width:15px;height:15px;border-radius:50%;border:1px solid var(--d-border);cursor:pointer;transition:opacity .12s'),
          background: selected ? 'var(--d-primary)' : 'var(--d-card)', opacity: selected ? 1 : 0.35,
        }} />
    </div>
  );
}

// Read-only reflection of the rules that actually apply to a visit: geofence is
// per-client, grace/late thresholds are the one provider setting. Not editable
// per visit by design — the office changes these on the client or in Settings.
const geofenceLabel = (mode) => (mode === 'strict' ? 'strict — must be on site' : mode === 'warn' ? 'warn carer if away' : 'record only');
function RulesNote({ su, settings }) {
  return (
    <div style={s('background:var(--d-note-bg);border-radius:12px;padding:11px 14px;display:flex;flex-direction:column;gap:6px;font-size:11.5px;font-weight:500;color:var(--d-note-ink);line-height:1.45')}>
      <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="pin" size={14} />Geofence: {su?.geofence_radius_m ?? '—'}m · {geofenceLabel(su?.geofence_mode)} <span style={s('opacity:0.7')}>· client rule</span></div>
      <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="clock" size={14} />Late after {settings?.late_grace_minutes ?? '—'} min grace <span style={s('opacity:0.7')}>· provider setting</span></div>
      <div style={s('display:flex;align-items:center;gap:8px')}><Icon name="fingerprint" size={14} />Clocked on the app (GPS); PIN tablet or manager attestation as fallbacks</div>
    </div>
  );
}

/* ---------- assign drawer (conflict-aware, real signals) ---------- */
function AssignDrawer({ visit, weekVisits, employees, serviceUsers, onClose, onAssigned }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  if (!visit) return null;

  const day = new Date(visit.scheduled_start);
  const start = toMin(formatTime(visit.scheduled_start).replace(':', ':'));
  const end = toMin(formatTime(visit.scheduled_end));
  const client = serviceUsers.find((c) => c.id === visit.service_user?.id);
  const regulars = new Set((client?.carers ?? []).map((n) => n.toLowerCase()));

  // Real conflict: does this carer already have a visit that overlaps, same day?
  const conflictFor = (empId) => {
    const clash = weekVisits.find((o) => o.id !== visit.id
      && sameDay(o.scheduled_start, day)
      && (o.assignments ?? []).some((a) => a.employee?.id === empId)
      && toMin(formatTime(o.scheduled_start)) < end && start < toMin(formatTime(o.scheduled_end)));
    return clash ? `Double-booked with ${fullName(clash.service_user)} ${formatTime(clash.scheduled_start)}` : null;
  };

  const ranked = employees.filter((e) => e.active)
    .filter((e) => { const q = query.trim().toLowerCase(); return !q || `${e.full_name} ${e.employee_reference ?? ''}`.toLowerCase().includes(q); })
    .map((e) => ({ e, regular: regulars.has((e.full_name ?? '').toLowerCase()), conflict: conflictFor(e.id) }))
    .sort((a, b) => (Number(!!a.conflict) - Number(!!b.conflict)) || (Number(b.regular) - Number(a.regular)) || a.e.full_name.localeCompare(b.e.full_name));

  async function assign(e) {
    setBusyId(e.id);
    try {
      const res = await assignEmployee({ visitId: visit.id, employeeId: e.id });
      const w = res.warnings ?? [];
      if (w.length) toast.warn(`${e.first_name} assigned. ${w.join('. ')}`); else toast.success(`${e.full_name} assigned`);
      onAssigned(); onClose();
    } catch (err) { toast.error(err.message || 'Could not assign that carer'); } finally { setBusyId(null); }
  }

  return (
    <Drawer title={`Assign carer — ${fullName(visit.service_user)}`}
      subtitle={`${day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} · ${formatTimeRange(visit.scheduled_start, visit.scheduled_end)}`}
      onClose={onClose}>
      <div style={s('padding:16px 22px 0')}>
        <div style={s('background:var(--d-panel);border-radius:16px;padding:13px 15px')}>
          <div style={s('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--d-muted)')}>Visit</div>
          <div style={s('font-size:14px;font-weight:700;color:var(--d-ink);margin-top:3px')}>{fullName(visit.service_user)}</div>
          <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);margin-top:2px;display:flex;align-items:center;gap:5px')}><Icon name="pin" size={13} />{[visit.service_user?.address_line1, visit.service_user?.postcode].filter(Boolean).join(', ')}</div>
        </div>
        <div style={s('height:44px;background:var(--d-field);border-radius:22px;display:flex;align-items:center;gap:9px;padding:0 16px;margin-top:14px')}>
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff by name or reference" autoFocus style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
        </div>
        <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);margin:16px 0 8px')}>Suggested carers</div>
      </div>
      <div style={s('flex:1;overflow-y:auto;padding:0 22px 20px;display:flex;flex-direction:column;gap:8px')}>
        {ranked.length === 0 ? (
          <div style={s('padding:26px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>No staff match that search.</div>
        ) : ranked.slice(0, 12).map(({ e, regular, conflict }) => (
          <button key={e.id} type="button" onClick={() => (busyId ? null : assign(e))}
            style={{ ...s('width:100%;text-align:left;border-radius:16px;padding:12px 14px;cursor:pointer;background:var(--d-panel);border:1px solid var(--d-border)'), opacity: busyId === e.id ? 0.6 : 1, fontFamily: 'inherit' }}>
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
    </Drawer>
  );
}

/* ---------- create-visit drawer (real fields only) ---------- */
function CreateVisitDrawer({ preset, serviceUsers, settings, weekMonday, onClose, onCreated }) {
  const toast = useToast();
  const [clientId, setClientId] = useState(preset?.clientId ?? serviceUsers[0]?.id ?? '');
  const [day, setDay] = useState(preset?.day ?? 0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [busy, setBusy] = useState(false);
  if (!preset) return null;
  const client = serviceUsers.find((c) => c.id === Number(clientId));

  async function save() {
    if (!clientId) { toast.error('Pick a client'); return; }
    const base = new Date(weekMonday); base.setDate(base.getDate() + Number(day));
    const mk = (t) => { const d = new Date(base); const [h, m] = t.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
    setBusy(true);
    try {
      await createVisit({ service_user_id: Number(clientId), scheduled_start: mk(start), scheduled_end: mk(end) });
      toast.success(`Visit created for ${fullName(client)}`);
      onCreated(); onClose();
    } catch (err) { toast.error(err.message || 'Could not create the visit'); } finally { setBusy(false); }
  }

  const field = s('display:flex;flex-direction:column;gap:6px');
  const label = s('font-size:11.5px;font-weight:700;color:var(--d-ink2)');
  const control = { ...s('height:42px;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Drawer title="New visit" subtitle="Add a one-off visit to the rota. It starts as a draft until you publish." onClose={onClose}
      footer={<div style={s('display:flex;justify-content:flex-end;gap:8px')}><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="check" onClick={busy ? undefined : save}>{busy ? 'Creating…' : 'Create visit'}</Button></div>}>
      <div style={s('padding:18px 22px;display:flex;flex-direction:column;gap:16px')}>
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
        <div style={s('display:flex;flex-direction:column;gap:6px')}><span style={label}>Rules that will apply</span><RulesNote su={client} settings={settings} /></div>
      </div>
    </Drawer>
  );
}

/* ---------- filled-visit editor drawer (retime + real actions) ---------- */
function VisitDetailDrawer({ visit, settings, onClose, onChanged }) {
  const toast = useToast();
  const [start, setStart] = useState(formatTime(visit?.scheduled_start));
  const [end, setEnd] = useState(formatTime(visit?.scheduled_end));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!visit) return null;
  const a = visit.assignments?.[0];
  const started = (visit.assignments ?? []).some((x) => x.actual_start);
  const tone = { neutral: 'muted', warn: 'warning', active: 'info' }[LIFECYCLE_TONE[stateOf(visit)]] ?? LIFECYCLE_TONE[stateOf(visit)];

  async function withdraw() { try { await withdrawAssignment(a.id); toast.info('Carer removed from that visit'); onChanged(); onClose(); } catch (e) { toast.error(e.message || 'Could not remove'); } }
  async function publish() { try { await publishVisit(visit.id); toast.success('Visit published'); onChanged(); onClose(); } catch (e) { toast.error(e.message || 'Could not publish'); } }
  async function save() {
    if (!reason.trim()) { toast.error('Add a reason — it goes in the audit trail'); return; }
    const base = new Date(visit.scheduled_start);
    const mk = (t) => { const d = new Date(base); const [h, m] = t.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
    setBusy(true);
    try {
      await editVisit(visit.id, { scheduled_start: mk(start), scheduled_end: mk(end), reason: reason.trim() });
      toast.success('Visit retimed — change logged to the audit trail');
      onChanged(); onClose();
    } catch (e) { toast.error(e.message || 'Could not retime the visit'); } finally { setBusy(false); }
  }

  const label = s('font-size:11.5px;font-weight:700;color:var(--d-ink2)');
  const control = { ...s('height:42px;border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:0 13px;font-size:13px;font-weight:600;color:var(--d-ink);outline:none;width:100%'), fontFamily: 'inherit' };

  return (
    <Drawer title={`Edit visit — ${fullName(visit.service_user)}`} subtitle={new Date(visit.scheduled_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} onClose={onClose}
      footer={<div style={s('display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap')}>
        {a && <Button icon="close" onClick={withdraw}>Remove carer</Button>}
        <div style={s('display:flex;gap:8px;margin-left:auto')}>
          {visit.status === 'draft' && <Button icon="send" onClick={publish}>Publish</Button>}
          {!started && <Button variant="primary" icon="check" onClick={busy ? undefined : save}>{busy ? 'Saving…' : 'Save changes'}</Button>}
        </div>
      </div>}>
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
        <RulesNote su={visit.service_user} settings={settings} />
        {started ? (
          <div style={s('font-size:12px;font-weight:500;color:var(--d-note-ink);background:var(--d-note-bg);border-radius:12px;padding:12px 14px;line-height:1.5')}>The carer has already clocked in, so the scheduled time is locked — the original record is never rewritten. Use a clock correction if the actual time is wrong.</div>
        ) : (
          <>
            <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
              <div style={s('display:flex;flex-direction:column;gap:6px')}><span style={label}>Start</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={control} /></div>
              <div style={s('display:flex;flex-direction:column;gap:6px')}><span style={label}>End</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={control} /></div>
            </div>
            <div style={s('display:flex;flex-direction:column;gap:6px')}>
              <span style={label}>Reason for change <span style={s('color:var(--d-danger-ink)')}>*</span></span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Client asked for a later call this week" style={{ ...control, ...s('height:auto;padding:10px 13px;resize:vertical') }} />
              <span style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>Required — stored in the audit trail with your name and time.</span>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

/* ---------- shared right-side drawer shell ---------- */
function Drawer({ title, subtitle, children, footer, onClose }) {
  return (
    <div onClick={onClose} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;justify-content:flex-end;z-index:100'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:460px;height:100%;background:var(--d-card);display:flex;flex-direction:column;overflow:hidden')}>
        <div style={s('padding:20px 22px 15px;border-bottom:1px solid var(--d-border);display:flex;align-items:flex-start;gap:12px')}>
          <div style={s('flex:1;min-width:0')}>
            <div style={s('font-size:18px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>{title}</div>
            {subtitle && <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);margin-top:3px')}>{subtitle}</div>}
          </div>
          <div onClick={onClose} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2);flex:none'), '--hbg': 'var(--d-sage)' }}><Icon name="close" size={16} /></div>
        </div>
        <div style={s('flex:1;overflow-y:auto;display:flex;flex-direction:column')}>{children}</div>
        {footer && <div style={s('padding:14px 22px;border-top:1px solid var(--d-border)')}>{footer}</div>}
      </div>
    </div>
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
  const [view, setView] = useState('carer');
  const [assigning, setAssigning] = useState(null);
  const [creating, setCreating] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState([]);
  const [exporting, setExporting] = useState(false);

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
      return [...employees].filter((e) => e.active).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((e) => ({
        id: `e${e.id}`, title: e.full_name, initials: inits(e),
        sub: `${e.hours_this_week ?? 0}h${e.contracted_hours_per_week ? ` / ${e.contracted_hours_per_week}h` : ''}${e.punctuality != null ? ` · ${e.punctuality}% on time` : ''}`,
        cell: (d) => visits.filter((v) => (v.assignments ?? []).some((a) => a.employee?.id === e.id) && sameDay(v.scheduled_start, d)),
      }));
    }
    return [...serviceUsers].filter((c) => c.active).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((c) => ({
      id: `c${c.id}`, title: c.full_name, initials: inits(c),
      sub: `${c.visits_per_week ?? 0} visits/wk${c.city ? ` · ${c.city}` : ''}`,
      cell: (d) => visits.filter((v) => v.service_user?.id === c.id && sameDay(v.scheduled_start, d)),
    }));
  }, [view, employees, serviceUsers, visits]);

  const unfilled = useMemo(() => visits.filter(isShort).sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start)), [visits]);
  const drafts = useMemo(() => visits.filter((v) => v.status === 'draft'), [visits]);
  const overContract = employees.filter((e) => e.hours_this_week != null && e.contracted_hours_per_week && e.hours_this_week > Number(e.contracted_hours_per_week)).length;
  const underContract = employees.filter((e) => e.hours_this_week != null && e.contracted_hours_per_week && e.hours_this_week < Number(e.contracted_hours_per_week)).length;
  const assignedCount = visits.filter((v) => !isShort(v)).length;

  const move = (w) => { const d = new Date(range.monday); d.setDate(d.getDate() + w * 7); setWeekStart(d); };
  const toggleSel = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const openBlock = (v) => (isShort(v) ? setAssigning(v) : setDetail(v));

  async function handleGenerate() { setBusy(true); try { const r = await generateVisits({ from: range.from, to: range.to }); toast.success(`${r.created} visits generated from care packages`); await load(); } catch (e) { toast.error(e.message || 'Could not generate visits'); } finally { setBusy(false); } }
  async function handleDuplicate() { setBusy(true); try { const prev = new Date(range.monday); prev.setDate(prev.getDate() - 7); await copyRota({ from_week_start: isoDate(prev), to_week_start: range.from }); toast.success('Last week duplicated into this week as drafts'); await load(); } catch (e) { toast.error(e.message || 'Could not duplicate the week'); } finally { setBusy(false); } }
  async function handlePublishAll() {
    if (drafts.length === 0) { toast.info('No draft visits to publish'); return; }
    setBusy(true);
    try { await Promise.all(drafts.map((v) => publishVisit(v.id))); toast.success(`Rota published — ${drafts.length} visit${drafts.length === 1 ? '' : 's'} now visible to carers`); await load(); }
    catch (e) { toast.error(e.message || 'Some visits could not be published'); } finally { setBusy(false); }
  }
  async function offerCover() { toast.info('Posted to the cover board for carers to claim'); }

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
          <Button icon="refresh" onClick={busy ? undefined : handleGenerate}>{busy ? 'Working…' : 'Generate from care packages'}</Button>
          <Button icon="sync" onClick={busy ? undefined : handleDuplicate}>Duplicate last week</Button>
          <Button icon="send" onClick={busy ? undefined : handlePublishAll}>{drafts.length ? `Publish rota (${drafts.length})` : 'Publish rota'}</Button>
          <Button icon="download" disabled={exporting} onClick={async () => { setExporting(true); try { await exportRota(range.from, range.to, 'csv'); toast.success('Rota CSV downloaded'); } catch (e) { toast.error(e.message || 'Export failed'); } finally { setExporting(false); } }}>CSV</Button>
          <Button icon="download" disabled={exporting} onClick={async () => { setExporting(true); try { await exportRota(range.from, range.to, 'xlsx'); toast.success('Rota XLSX downloaded'); } catch (e) { toast.error(e.message || 'Export failed'); } finally { setExporting(false); } }}>{exporting ? 'Exporting…' : 'Export rota'}</Button>
          <Button variant="primary" icon="plus" onClick={() => setCreating({ day: 0 })}>Add visit</Button>
        </div>
      )}

      {/* Week bar + view + status + legend */}
      <div style={s('display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap')}>
        <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
          <div style={s('display:flex;align-items:center;gap:8px')}>
            <div className="hv" onClick={() => move(-1)} style={circleBtn}><Icon name="chevronLeft" size={17} /></div>
            <span style={s('font-size:13.5px;font-weight:700;color:var(--d-ink);min-width:132px;text-align:center')}>{range.monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {range.sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <div className="hv" onClick={() => move(1)} style={circleBtn}><Icon name="chevronRight" size={17} /></div>
          </div>
          <div onClick={() => setWeekStart(weekOf().monday)} className="hv" style={{ ...s('height:34px;border-radius:17px;background:var(--d-panel);display:flex;align-items:center;padding:0 14px;font-size:12.5px;font-weight:700;color:var(--d-ink2);cursor:pointer'), '--hbg': 'var(--d-sage)' }}>This week</div>
          <SegTabs tabs={viewTabs} active={view} onSelect={setView} />
          <Tag tone={drafts.length ? 'warning' : 'success'}>{drafts.length ? `Draft — ${drafts.length} unpublished` : 'Published'}</Tag>
        </div>
        <div style={s('display:flex;flex-wrap:wrap;gap:12px;font-size:11px;font-weight:600;color:var(--d-muted)')}>
          {LEGEND.map(([l, dot]) => (
            <span key={l} style={s('display:inline-flex;align-items:center;gap:5px')}><span style={{ ...s('width:8px;height:8px;border-radius:50%'), background: dot }} />{l}</span>
          ))}
          <span style={s('display:inline-flex;align-items:center;gap:5px')}><span style={s('width:8px;height:8px;border-radius:50%;border:1px dashed var(--d-danger-dot)')} />Unfilled</span>
        </div>
      </div>

      <p style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin:0')}>Click a block to open it — an unfilled visit opens the assign panel, a filled one its detail. Use the dot on a block to select visits for a bulk action.</p>

      {loading ? <Spinner /> : (
        <>
          {/* Grid — bordered spreadsheet: sticky first column, ruled cells */}
          <div style={s('background:var(--d-card);border-radius:16px;border:1px solid var(--d-border);overflow:hidden')}>
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
                          {cell.map((v) => <VisitBlock key={v.id} v={v} view={view} selected={selected.includes(v.id)} onToggle={() => toggleSel(v.id)} onOpen={() => openBlock(v)} />)}
                          {canManage && view === 'client' && (
                            <button type="button" aria-label="Add visit" onClick={() => setCreating({ day: weekDays.indexOf(d), clientId: Number(row.id.slice(1)) })}
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

          {/* Unfilled + Rota health */}
          <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px')}>
            <Panel>
              <PanelTitle hint="No carer assigned — client at risk of a missed visit">Unfilled visits</PanelTitle>
              {unfilled.length === 0 ? (
                <div style={s('display:flex;align-items:center;gap:10px;padding:6px 2px')}>
                  <div style={s('width:34px;height:34px;border-radius:11px;background:var(--d-ok-bg);display:flex;align-items:center;justify-content:center;color:var(--d-ok-ink)')}><Icon name="check" size={17} /></div>
                  <div style={s('font-size:13px;font-weight:600;color:var(--d-ink2)')}>Every visit this week has a carer.</div>
                </div>
              ) : (
                <div style={s('display:flex;flex-direction:column;gap:9px')}>
                  {unfilled.map((v) => (
                    <div key={v.id} style={s('display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--d-danger-bg2);background:var(--d-danger-bg);border-radius:14px;padding:11px 13px')}>
                      <div style={s('min-width:0')}>
                        <div style={s('display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--d-danger-ink)')}><Icon name="alert" size={15} />{fullName(v.service_user)}</div>
                        <div className="d-num" style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{new Date(v.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {formatTimeRange(v.scheduled_start, v.scheduled_end)}</div>
                      </div>
                      {canManage && (
                        <div style={s('display:flex;gap:6px')}>
                          <Button size="sm" icon="plus" onClick={() => setAssigning(v)}>Assign</Button>
                          <Button size="sm" icon="send" onClick={offerCover}>Offer cover</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <PanelTitle hint="This week at a glance, from real records">Rota health</PanelTitle>
              <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:9px')}>
                {[
                  ['Visits planned', visits.length],
                  ['Unfilled visits', unfilled.length],
                  ['Assigned visits', assignedCount],
                  ['Carers over contract', overContract],
                  ['Carers under contract', underContract],
                  ['Awaiting publish', drafts.length],
                ].map(([l, val]) => (
                  <div key={l} style={s('background:var(--d-panel);border-radius:13px;padding:12px 14px')}>
                    <div style={s('font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--d-muted)')}>{l}</div>
                    <div className="d-num" style={s('font-size:20px;font-weight:700;color:var(--d-ink);margin-top:3px')}>{val}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
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
      {creating && <CreateVisitDrawer preset={creating} serviceUsers={serviceUsers} settings={settings} weekMonday={range.monday} onClose={() => setCreating(null)} onCreated={load} />}
      {detail && <VisitDetailDrawer visit={detail} settings={settings} onClose={() => setDetail(null)} onChanged={load} />}
    </div>
  );
}
