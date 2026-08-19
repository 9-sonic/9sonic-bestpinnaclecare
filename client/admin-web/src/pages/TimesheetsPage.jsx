import { useEffect, useMemo, useState } from 'react';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listAttendanceAudit, exportAttendanceAudit, listServiceUsers, listEmployees } from '../api/index.js';
import { fullName, formatDate, formatTime } from '../api/format.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { Panel, PanelTitle, StatCard, Avatar, Tag, Button, TableWrap, Th, Td, Row, DateField, SelectField, RangeChips, FilterBar } from '../ds/console.jsx';

// CQC visit-attendance audit: one row per carer x visit, filterable by date
// range, client and carer — the same data as the CSV/XLSX export
// (AttendanceAudit::Build), read straight from verified clock records. This
// view never changes them.
const iso = (d) => d.toISOString().slice(0, 10);
const initials = (name) => (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export default function TimesheetsPage() {
  const toast = useToast();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [serviceUserId, setServiceUserId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rows, setRows] = useState(null); // null = loading
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([listServiceUsers().catch(() => []), listEmployees().catch(() => [])])
      .then(([su, e]) => { setClients(su); setStaff(e); });
  }, []);

  useEffect(() => {
    let active = true;
    setRows(null);
    listAttendanceAudit({ from: `${from}T00:00:00`, to: `${to}T23:59:59`, serviceUserId, employeeId })
      .then((r) => { if (active) setRows(r ?? []); })
      .catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [from, to, serviceUserId, employeeId]);

  const setRange = (days) => { setTo(iso(new Date())); setFrom(iso(new Date(Date.now() - (days - 1) * 86400000))); };
  // Which quick-range chip (if any) matches the current from/to, so it can read
  // as selected. Matches only when To is today, like the chips set it.
  const activeSpan = to === iso(new Date())
    ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
    : null;

  const handleExport = async (type) => {
    setExporting(true);
    try {
      await exportAttendanceAudit(`${from}T00:00:00`, `${to}T23:59:59`, type, { serviceUserId, employeeId });
      toast.success(`${type.toUpperCase()} downloaded`);
    } catch (e) { toast.error(e.message || 'Export failed'); }
    finally { setExporting(false); }
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
          <RangeChips active={activeSpan} onSelect={setRange} />
          <SelectField label="Client" value={serviceUserId} onChange={setServiceUserId} options={clientOptions} allLabel="All" />
          <SelectField label="Carer" value={employeeId} onChange={setEmployeeId} options={staffOptions} allLabel="All" />
          <FilterBar.Spacer />
          <Button icon="download" disabled={exporting} onClick={() => handleExport('csv')}>CSV</Button>
          <Button variant="primary" icon="download" disabled={exporting} onClick={() => handleExport('xlsx')}>{exporting ? 'Building…' : 'Export XLSX'}</Button>
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
                <Th>Origin</Th>
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
                  <Td>{(r.offline_in === 'Yes' || r.offline_out === 'Yes') ? <Tag tone="magenta">Offline sync</Tag> : <span style={s('font-size:11.5px;font-weight:600;color:var(--d-muted)')}>Live</span>}</Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}

    </div>
  );
}
