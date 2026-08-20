import { useCallback, useEffect, useMemo, useState } from 'react';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { listAttendanceAudit, exportAttendanceAudit, listServiceUsers, listEmployees, correctClock } from '../api/index.js';
import { fullName, formatDate, formatTime } from '../api/format.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import Modal from '../components/common/Modal.jsx';
import { Panel, PanelTitle, StatCard, Avatar, Tag, Button, ExportButton, TableWrap, Th, Td, Row, DateField, SelectField, FilterBar } from '../ds/console.jsx';

// CQC visit-attendance audit: one row per carer x visit, filterable by date
// range, client and carer — the same data as the CSV/XLSX export
// (AttendanceAudit::Build), read straight from verified clock records. This
// view never changes them.
const iso = (d) => d.toISOString().slice(0, 10);
const initials = (name) => (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

// Correct a visit's clock in/out from the attendance record. Posts to the same
// audited correctClock endpoint the Exceptions queue uses — a manual_admin event
// appended with a mandatory reason; the original is never overwritten and the
// lifecycle status recomputes from the corrected times.
function AmendModal({ row, onClose, onDone }) {
  const toast = useToast();
  const origIn = row.clocked_in ? formatTime(row.clocked_in) : '';
  const origOut = row.clocked_out ? formatTime(row.clocked_out) : '';
  const [inTime, setInTime] = useState(origIn);
  const [outTime, setOutTime] = useState(origOut);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // HH:MM -> ISO anchored to the visit's scheduled day (shift_began from the row).
  const mk = (t) => { const base = new Date(row.shift_began ?? Date.now()); const [h, m] = t.split(':').map(Number); base.setHours(h, m, 0, 0); return base.toISOString(); };

  async function save() {
    if (!reason.trim()) { toast.error('A reason is required — it goes in the audit trail'); return; }
    const jobs = [];
    if (inTime && inTime !== origIn) jobs.push(correctClock({ visit_assignment_id: row.visit_assignment_id, kind: 'clock_in', occurred_at: mk(inTime), reason: reason.trim() }));
    if (outTime && outTime !== origOut) jobs.push(correctClock({ visit_assignment_id: row.visit_assignment_id, kind: 'clock_out', occurred_at: mk(outTime), reason: reason.trim() }));
    if (jobs.length === 0) { toast.info('Change a clock time to record a correction'); return; }
    setBusy(true);
    try { await Promise.all(jobs); toast.success('Correction recorded against the original'); onDone(); onClose(); }
    catch (e) { toast.error(e.message || 'Could not record the correction'); } finally { setBusy(false); }
  }

  const field = { ...s('height:40px;border-radius:11px;border:1.5px solid var(--d-border);background:var(--d-card);color:var(--d-ink);font-size:13px;font-weight:600;padding:0 12px;width:100%;box-sizing:border-box'), fontFamily: 'inherit', colorScheme: 'light dark' };

  return (
    <Modal
      onClose={onClose}
      maxWidth={460}
      title={`Correct clock times — ${row.staff}`}
      subtitle={<span style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{row.service_user} · {formatDate(row.shift_began)} · scheduled {row.shift_timing}</span>}
      footer={
        <div style={s('display:flex;gap:8px;justify-content:flex-end')}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={busy || !reason.trim()} onClick={busy ? undefined : save}>{busy ? 'Saving…' : 'Save & verify'}</Button>
        </div>
      }
    >
      <div style={s('flex:1;overflow-y:auto;padding:18px 22px;display:flex;flex-direction:column;gap:14px')}>
        <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
          <label style={s('display:flex;flex-direction:column;gap:5px')}>
            <span style={s('font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Clock in</span>
            <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} style={field} />
          </label>
          <label style={s('display:flex;flex-direction:column;gap:5px')}>
            <span style={s('font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Clock out</span>
            <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} style={field} />
          </label>
        </div>
        <label style={s('display:flex;flex-direction:column;gap:5px')}>
          <span style={s('font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Reason (required)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Carer confirmed by phone they left at 19:05; battery died." style={{ ...field, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }} />
        </label>
        <div style={s('background:var(--d-note-bg);border-radius:14px;padding:12px 15px;font-size:11.5px;font-weight:500;color:var(--d-note-ink);line-height:1.55')}>Saving writes a new, immutable audit entry under your name with the original and new values and your reason. Nothing is overwritten; status recomputes from the corrected times.</div>
      </div>
    </Modal>
  );
}

export default function TimesheetsPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [amending, setAmending] = useState(null); // the row being corrected
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [serviceUserId, setServiceUserId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rows, setRows] = useState(null); // null = loading

  useEffect(() => {
    Promise.all([listServiceUsers().catch(() => []), listEmployees().catch(() => [])])
      .then(([su, e]) => { setClients(su); setStaff(e); });
  }, []);

  // Load the attendance rows for the current filters. Extracted so a recorded
  // correction can refresh the table (onDone) with the corrected times.
  const load = useCallback(async () => {
    setRows(null);
    try { setRows(await listAttendanceAudit({ from: `${from}T00:00:00`, to: `${to}T23:59:59`, serviceUserId, employeeId }) ?? []); }
    catch { setRows([]); }
  }, [from, to, serviceUserId, employeeId]);

  useEffect(() => { load(); }, [load]);


  const handleExport = async (type) => {
    try {
      await exportAttendanceAudit(`${from}T00:00:00`, `${to}T23:59:59`, type, { serviceUserId, employeeId });
      toast.success(`${type.toUpperCase()} downloaded`);
    } catch (e) { toast.error(e.message || 'Export failed'); return false; }
  };

  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, label: fullName(c) })).sort((a, b) => a.label.localeCompare(b.label)), [clients]);
  const staffOptions = useMemo(() => staff.map((e) => ({ id: e.id, label: fullName(e) })).sort((a, b) => a.label.localeCompare(b.label)), [staff]);

  // Summary stats for the range currently on screen.
  const stats = useMemo(() => {
    const r = rows ?? [];
    const missedIn = r.filter((x) => !x.clocked_in).length;
    const missedOut = r.filter((x) => x.clocked_in && !x.clocked_out).length;
    const late = r.filter((x) => (x.late_in ?? 0) > 0).length;
    const offline = r.filter((x) => x.offline_in === 'Yes' || x.offline_out === 'Yes').length;
    return { total: r.length, missedIn, missedOut, late, offline };
  }, [rows]);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px')}>
        <StatCard label="Visits in range" value={rows === null ? '–' : stats.total} hint={`${formatDate(`${from}T00:00:00`)} – ${formatDate(`${to}T00:00:00`)}`} tone="primary" icon="calendar" />
        <StatCard label="Late arrivals" value={rows === null ? '–' : stats.late} hint="Clocked in after grace" tone="warning" icon="clock" />
        <StatCard label="Missed clock-ins/outs" value={rows === null ? '–' : stats.missedIn + stats.missedOut} hint="No tap recorded" tone="danger" icon="alert" />
        <StatCard label="Offline-synced taps" value={rows === null ? '–' : stats.offline} hint="Recorded without signal, synced later" tone="magenta" icon="sync" />
      </div>

      <Panel>
        <PanelTitle>Visit attendance</PanelTitle>
        <FilterBar data-tour="timesheets-period" style={{ marginTop: 4 }}>
          <DateField label="From" value={from} onChange={setFrom} max={to} />
          <DateField label="To" value={to} onChange={(val) => setTo(val < from ? from : val)} min={from} />
          <SelectField label="Client" value={serviceUserId} onChange={setServiceUserId} options={clientOptions} allLabel="All" />
          <SelectField label="Carer" value={employeeId} onChange={setEmployeeId} options={staffOptions} allLabel="All" />
          <FilterBar.Spacer />
          <ExportButton onExport={handleExport} title="Export timesheets" subtitle="Choose a file format. The current date range and filters are applied." />
        </FilterBar>
      </Panel>

      {rows === null ? (
        <Panel style={{ padding: '60px 24px' }}><Spinner /></Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <div style={s('display:flex;flex-direction:column;align-items:center;gap:10px;padding:46px 20px')}>
            <div style={s('width:52px;height:52px;border-radius:16px;background:var(--d-panel);display:flex;align-items:center;justify-content:center;color:var(--d-muted)')}><Icon name="calendar" size={24} /></div>
            <div style={s('font-size:14px;font-weight:700;color:var(--d-ink2)')}>No visits in this range</div>
            <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Try a wider date range, or clear the client/carer filter.</div>
          </div>
        </Panel>
      ) : (
        <Panel padded={false} data-tour="timesheets-table" style={{ padding: '12px 14px', overflow: 'auto' }}>
          <TableWrap minWidth={1120}>
            <thead>
              <tr>
                <Th>Carer</Th><Th>Client</Th><Th>Shift</Th>
                <Th>Clocked in</Th><Th align="right">Late</Th><Th align="right">Distance</Th>
                <Th>Clocked out</Th><Th align="right">Late</Th><Th align="right">Distance</Th>
                <Th>Origin</Th>{canManage && <Th align="right" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Row key={i}>
                  <Td>
                    <span style={s('display:inline-flex;align-items:center;gap:9px')}>
                      <Avatar initials={initials(r.staff ?? '?')} size="sm" />
                      <b style={s('font-weight:700;color:var(--d-ink)')}>{r.staff ?? 'Unassigned'}</b>
                    </span>
                  </Td>
                  <Td>{r.service_user}</Td>
                  <Td>
                    <span style={s('display:block;font-weight:600;color:var(--d-ink)')}>{formatDate(r.shift_began)}</span>
                    <span className="d-num" style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>{r.shift_timing}</span>
                  </Td>
                  <Td mono>{r.clocked_in ? formatTime(r.clocked_in) : <Tag tone="danger">Missed</Tag>}</Td>
                  <Td align="right" mono>{r.late_in ? <span style={s('color:var(--d-warn-ink);font-weight:700')}>+{r.late_in}m</span> : (r.clocked_in ? <span style={s('color:var(--d-faint)')}>on time</span> : '')}</Td>
                  <Td align="right" mono>{r.metres_in != null ? `${r.metres_in}m` : <span style={s('color:var(--d-faint)')}>–</span>}</Td>
                  <Td mono>{r.clocked_out ? formatTime(r.clocked_out) : (r.clocked_in ? <Tag tone="warning">Missed</Tag> : <span style={s('color:var(--d-faint)')}>–</span>)}</Td>
                  <Td align="right" mono>{r.late_out ? <span style={s('color:var(--d-warn-ink);font-weight:700')}>+{r.late_out}m</span> : (r.clocked_out ? <span style={s('color:var(--d-faint)')}>on time</span> : '')}</Td>
                  <Td align="right" mono>{r.metres_out != null ? `${r.metres_out}m` : <span style={s('color:var(--d-faint)')}>–</span>}</Td>
                  <Td>{(r.offline_in === 'Yes' || r.offline_out === 'Yes') ? <Tag tone="violet">Offline sync</Tag> : <Tag tone="success">Live</Tag>}</Td>
                  {canManage && <Td align="right">{r.visit_assignment_id && <Button size="sm" icon="edit" onClick={() => setAmending(r)}>Amend</Button>}</Td>}
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}

      {amending && <AmendModal row={amending} onClose={() => setAmending(null)} onDone={load} />}
    </div>
  );
}
