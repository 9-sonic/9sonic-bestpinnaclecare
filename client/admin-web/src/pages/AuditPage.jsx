import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listAudit, exportAuditLog, exportAttendanceAudit, listLoginAttempts, listServiceUsers, listEmployees, listAdmins } from '../api/index.js';
import { formatDate, formatTime, fullName } from '../api/format.js';
import Spinner from '../components/common/Spinner.jsx';
import { Panel, PanelTitle, Tag, Button, ExportButton, TableWrap, Th, Td, Row, SegTabs, DateField, SelectField, FilterBar } from '../ds/console.jsx';

const FILTERS = [
  { id: 'all', label: 'Everything', icon: 'menu', test: () => true },
  { id: 'amend', label: 'Amendments', icon: 'edit', test: (e) => /Amended/.test(e.action) },
  { id: 'approve', label: 'Approvals', icon: 'check', test: (e) => /Approved|Locked/.test(e.action) },
  { id: 'assign', label: 'Assignments', icon: 'user', test: (e) => /Assign/.test(e.action) },
  { id: 'system', label: 'Automations', icon: 'sync', test: (e) => e.author === 'System' },
];

// Map an Event from /admin/audit onto the table's row shape.
const ACTION = {
  'clock.corrected': 'Amended clock',
  'assignment.created': 'Assigned carer', 'assignment.withdrawn': 'Withdrew assignment', 'settings.updated': 'Changed setting',
  'service_user.created': 'Added client', 'service_user.updated': 'Edited client',
  'employee.invited': 'Invited carer', 'employee.updated': 'Edited carer',
};
const RECORD = { VisitAssignment: 'Visit', Setting: 'Settings', ServiceUser: 'Client', Employee: 'Employee', Visit: 'Visit', Alert: 'Alert' };
const TONE = {
  'clock.corrected': 'warning',
  'assignment.created': 'info', 'assignment.withdrawn': 'muted', 'settings.updated': 'info',
  'service_user.created': 'success', 'service_user.updated': 'info',
  'employee.invited': 'success', 'employee.updated': 'info',
};
function changeOf(e) {
  const p = e.payload ?? {};
  switch (e.event_type) {
    case 'clock.corrected': return p.kind ? String(p.kind).replace(/_/g, ' ') : 'correction';
    case 'assignment.created': return `→ ${p.employee_name ?? 'carer'}`;
    case 'assignment.withdrawn': return 'withdrawn';
    case 'settings.updated': return (p.changed ?? []).join(', ') || 'updated';
    case 'service_user.created': return 'created';
    case 'service_user.updated':
    case 'employee.updated': return Object.keys(p.to ?? {}).join(', ') || 'updated';
    case 'employee.invited': return p.email ?? 'invited';
    default: return '—';
  }
}
function mapEvent(e) {
  return {
    id: e.id,
    date: formatDate(e.occurred_at),
    time: formatTime(e.occurred_at),
    author: e.actor_name ?? 'System',
    action: ACTION[e.event_type] ?? e.event_type.replace(/[._]/g, ' '),
    record: `${RECORD[e.aggregate_type] ?? e.aggregate_type} #${e.aggregate_id}`,
    change: changeOf(e),
    reason: (e.payload ?? {}).reason ?? '—',
    tone: TONE[e.event_type] ?? 'muted',
    ipAddress: e.ip_address,
    device: e.device_fingerprint,
  };
}

// CQC visit-attendance export: one row per carer × visit over a date range, as
// CSV or XLSX. Lifted onto the Exports tab; self-contained (own date state).
export function VisitAuditExport() {
  const toast = useToast();
  const iso = (d) => d.toISOString().slice(0, 10);
  const [vaFrom, setVaFrom] = useState(iso(new Date(Date.now() - 6 * 86400000)));
  const [vaTo, setVaTo] = useState(iso(new Date()));

  const downloadVisitAudit = async (type) => {
    try {
      // Send full-day bounds so the To date is inclusive.
      await exportAttendanceAudit(`${vaFrom}T00:00:00`, `${vaTo}T23:59:59`, type);
      toast.success(`Visit audit ${type.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(e.message || 'Export failed');
      return false;
    }
  };

  return (
    <Panel>
      <PanelTitle hint="One row per carer × visit — scheduled vs actual taps, metres from the client's home, offline flags, lateness and map links. The CQC attendance export.">Visit attendance audit</PanelTitle>
      <FilterBar style={{ marginTop: 4 }}>
        <DateField label="From" value={vaFrom} onChange={setVaFrom} max={vaTo} />
        <DateField label="To" value={vaTo} onChange={(val) => setVaTo(val < vaFrom ? vaFrom : val)} min={vaFrom} />
        <FilterBar.Spacer />
        <ExportButton onExport={downloadVisitAudit} title="Export visit audit" subtitle="Choose a file format. The date range on screen is applied." />
      </FilterBar>
    </Panel>
  );
}

// Full append-only change-log export (all events) as CSV or XLSX.
export function AuditLogExport() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const pull = async (type) => {
    setExporting(true);
    try {
      await exportAuditLog({}, type);
      toast.success(`Audit ${type.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div style={s('display:flex;gap:8px')}>
      <Button icon="download" disabled={exporting} onClick={() => pull('csv')}>CSV</Button>
      <Button variant="primary" icon="download" disabled={exporting} onClick={() => pull('xlsx')}>{exporting ? 'Exporting…' : 'Export change log'}</Button>
    </div>
  );
}

export default function ChangeLogTab() {
  const [entries, setEntries] = useState(null); // null = loading
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorId, setActorId] = useState(''); // which staff/admin did it — always Employee (carers are the only non-admin actor)
  const [clientId, setClientId] = useState(''); // which client's record — aggregate_type ServiceUser
  const [staff, setStaff] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    listEmployees().then(setStaff).catch(() => setStaff([]));
    listServiceUsers().then(setClients).catch(() => setClients([]));
  }, []);

  useEffect(() => {
    let active = true;
    setEntries(null);
    const params = { limit: 100 };
    if (from) params.from = `${from}T00:00:00`;
    if (to) params.to = `${to}T23:59:59`;
    if (actorId) { params.actor_type = 'Employee'; params.actor_id = actorId; }
    if (clientId) { params.aggregate_type = 'ServiceUser'; params.aggregate_id = clientId; }
    listAudit(params)
      .then((events) => { if (active) setEntries((events ?? []).map(mapEvent)); })
      .catch(() => { if (active) setEntries([]); });
    return () => { active = false; };
  }, [from, to, actorId, clientId]);

  const rows = useMemo(() => {
    if (!entries) return [];
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const q = query.trim().toLowerCase();
    return entries.filter(f.test).filter((e) => (q ? `${e.author} ${e.action} ${e.record} ${e.reason}`.toLowerCase().includes(q) : true));
  }, [entries, filter, query]);

  const staffOptions = useMemo(() => staff.map((e) => ({ id: e.id, label: fullName(e) })).sort((a, b) => a.label.localeCompare(b.label)), [staff]);
  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, label: fullName(c) })).sort((a, b) => a.label.localeCompare(b.label)), [clients]);

  if (!entries) return <Spinner fullscreen />;

  const byDate = {};
  for (const e of rows) (byDate[e.date] ??= []).push(e);
  const dates = Object.keys(byDate);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* The visit-attendance (CQC) export lives here with the audit data it
          draws from, rather than in a separate Exports tab. */}
      <VisitAuditExport />
      <div style={s('display:flex;flex-direction:column')}>
        <div style={s('display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
          <span style={s('flex:1;min-width:0')}><SegTabs tabs={FILTERS.map((f) => ({ key: f.id, label: f.label, count: entries.filter(f.test).length }))} active={filter} onSelect={setFilter} /></span>
          {/* Download the change log the tab is showing. */}
          <AuditLogExport />
        </div>
        <div style={s('display:flex;flex-direction:column;gap:14px;margin-top:12px')}>
          <Panel>
            <FilterBar>
              <DateField label="From" value={from} onChange={setFrom} max={to || undefined} />
              <DateField label="To" value={to} onChange={(val) => setTo(from && val < from ? from : val)} min={from || undefined} />
              <SelectField label="Staff" value={actorId} onChange={setActorId} options={staffOptions} allLabel="Everyone" />
              <SelectField label="Client" value={clientId} onChange={setClientId} options={clientOptions} allLabel="Everyone" />
              <div style={s('flex:1;min-width:200px;height:40px;background:var(--d-card);border:1.5px solid var(--d-border);border-radius:12px;display:flex;align-items:center;gap:9px;padding:0 13px;align-self:flex-end')}>
                <Icon name="search" size={15} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search author, record or reason" style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:12.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
              </div>
            </FilterBar>
          </Panel>

          {dates.length === 0 ? (
            <Panel><div style={s('padding:40px 16px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>No entries match.</div></Panel>
          ) : dates.map((date) => (
        <Panel key={date} padded={false} style={{ padding: '18px 20px' }}>
          <div style={s('font-size:13px;font-weight:700;color:var(--d-ink);margin-bottom:6px')}>{date}</div>
          <TableWrap minWidth={960}>
            <thead><tr><Th>Time</Th><Th>Author</Th><Th>Action</Th><Th>Record</Th><Th>Change</Th><Th>Reason</Th><Th>IP / Device</Th></tr></thead>
            <tbody>
              {byDate[date].map((e) => (
                <Row key={e.id}>
                  <Td mono>{e.time}</Td>
                  <Td>
                    <span style={s('display:inline-flex;align-items:center;gap:7px')}>
                      <span style={{ ...s('width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;flex:none'), background: e.author === 'System' ? 'var(--d-primary-soft)' : 'var(--d-sage)', color: e.author === 'System' ? 'var(--d-primary-deep)' : 'var(--d-ink2)' }}><Icon name={e.author === 'System' ? 'sync' : 'user'} size={12} /></span>
                      <b style={s('font-weight:700;color:var(--d-ink)')}>{e.author}</b>
                    </span>
                  </Td>
                  <Td><Tag tone={e.tone}>{e.action}</Tag></Td>
                  <Td>{e.record}</Td>
                  <Td mono>{e.change}</Td>
                  <Td>{e.reason}</Td>
                  <Td mono>
                    {e.ipAddress
                      ? <span style={s('font-size:11.5px;color:var(--d-muted)')}>{e.ipAddress}{e.device ? ` · ${e.device.slice(0, 8)}` : ''}</span>
                      : <span style={s('color:var(--d-faint)')}>—</span>}
                  </Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
          ))}
        </div>
      </div>

      <div style={s('background:var(--d-note-bg);border-radius:14px;padding:12px 15px;display:flex;align-items:center;gap:10px;font-size:12px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>
        <Icon name="shield" size={15} />
        <span style={s('flex:1;min-width:0')}>This record is append-only — corrections add history, never overwrite it. How it&rsquo;s governed is in the Guide.</span>
      </div>
    </div>
  );
}

// Sign-in history: every login try (admin or carer), success or failure, with
// IP and device. Filterable by date range and by who — admin or staff.
export function SignInsTab() {
  const [rows, setRows] = useState(null); // null = loading
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [resource, setResource] = useState(''); // '' | 'Admin:<id>' | 'Employee:<id>'
  const [success, setSuccess] = useState(''); // '' | 'true' | 'false'
  const [staff, setStaff] = useState([]);
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    listEmployees().then(setStaff).catch(() => setStaff([]));
    listAdmins().then(setAdmins).catch(() => setAdmins([]));
  }, []);

  useEffect(() => {
    let active = true;
    setRows(null);
    const params = { limit: 100 };
    if (from) params.from = `${from}T00:00:00`;
    if (to) params.to = `${to}T23:59:59`;
    if (success) params.success = success;
    if (resource) { const [type, id] = resource.split(':'); params.resource_type = type; params.resource_id = id; }
    listLoginAttempts(params)
      .then((la) => { if (active) setRows(la ?? []); })
      .catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [from, to, resource, success]);

  const resourceOptions = useMemo(() => [
    ...admins.map((a) => ({ id: `Admin:${a.id}`, label: `${fullName(a)} (office)` })),
    ...staff.map((e) => ({ id: `Employee:${e.id}`, label: `${fullName(e)} (carer)` })),
  ].sort((a, b) => a.label.localeCompare(b.label)), [admins, staff]);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <Panel>
        <PanelTitle hint="Every sign-in try, success or failure — who, when, from what IP and device">Sign-ins</PanelTitle>
        <FilterBar style={{ marginTop: 4 }}>
          <DateField label="From" value={from} onChange={setFrom} max={to || undefined} />
          <DateField label="To" value={to} onChange={(val) => setTo(from && val < from ? from : val)} min={from || undefined} />
          <SelectField label="Who" value={resource} onChange={setResource} options={resourceOptions} allLabel="Everyone" />
          <SelectField label="Outcome" value={success} onChange={setSuccess} minWidth={140} allLabel="Any"
            options={[{ id: 'true', label: 'Success' }, { id: 'false', label: 'Failed' }]} />
        </FilterBar>
      </Panel>

      {rows === null ? (
        <Panel style={{ padding: '48px 24px' }}><Spinner /></Panel>
      ) : rows.length === 0 ? (
        <Panel><div style={s('padding:40px 16px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>No sign-ins match.</div></Panel>
      ) : (
        <Panel padded={false} style={{ padding: '12px 14px', overflow: 'auto' }}>
          <TableWrap minWidth={920}>
            <thead><tr><Th>When</Th><Th>Who</Th><Th>Type</Th><Th>Outcome</Th><Th>IP address</Th><Th>Device / User agent</Th></tr></thead>
            <tbody>
              {rows.map((la) => (
                <Row key={la.id}>
                  <Td mono>{formatDate(la.occurred_at)} {formatTime(la.occurred_at)}</Td>
                  <Td>
                    <b style={s('font-weight:700;color:var(--d-ink);display:block')}>{la.resource_name ?? la.attempted_email}</b>
                    {la.resource_name && <span style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>{la.attempted_email}</span>}
                  </Td>
                  <Td>{la.scope === 'admin' ? 'Office' : 'Carer'}</Td>
                  <Td>
                    {la.success
                      ? <Tag tone="success">Success</Tag>
                      : <Tag tone="danger">{(la.failure_reason ?? 'failed').replace(/_/g, ' ')}</Tag>}
                  </Td>
                  <Td mono>{la.ip_address ?? <span style={s('color:var(--d-faint)')}>—</span>}</Td>
                  <Td>
                    <span style={s('font-size:11.5px;color:var(--d-muted);word-break:break-all')}>
                      {[la.user_agent, la.device_fingerprint].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}
    </div>
  );
}
