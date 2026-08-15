import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listAudit, exportAuditLog, exportAttendanceAudit } from '../api/index.js';
import { formatDate, formatTime } from '../api/format.js';
import Spinner from '../components/common/Spinner.jsx';
import { Panel, PanelTitle, Tag, Button, TableWrap, Th, Td, Row, SegTabs } from '../ds/console.jsx';

const FILTERS = [
  { id: 'all', label: 'Everything', icon: 'menu', test: () => true },
  { id: 'amend', label: 'Amendments', icon: 'edit', test: (e) => /Amended/.test(e.action) },
  { id: 'approve', label: 'Approvals', icon: 'check', test: (e) => /Approved|Locked/.test(e.action) },
  { id: 'assign', label: 'Assignments', icon: 'user', test: (e) => /Assign/.test(e.action) },
  { id: 'system', label: 'Automations', icon: 'sync', test: (e) => e.author === 'System' },
];

// Map an Event from /admin/audit onto the table's row shape.
const ACTION = {
  'clock.corrected': 'Amended clock', 'timesheet.approved': 'Approved period', 'timesheet.locked': 'Locked period',
  'assignment.created': 'Assigned carer', 'assignment.withdrawn': 'Withdrew assignment', 'settings.updated': 'Changed setting',
};
const RECORD = { VisitAssignment: 'Visit', TimesheetPeriod: 'Timesheet', Setting: 'Settings', ServiceUser: 'Client', Employee: 'Employee', Visit: 'Visit', Alert: 'Alert' };
const TONE = {
  'clock.corrected': 'warning', 'timesheet.approved': 'success', 'timesheet.locked': 'success',
  'assignment.created': 'info', 'assignment.withdrawn': 'muted', 'settings.updated': 'info',
};
function changeOf(e) {
  const p = e.payload ?? {};
  switch (e.event_type) {
    case 'clock.corrected': return p.kind ? String(p.kind).replace(/_/g, ' ') : 'correction';
    case 'assignment.created': return `→ ${p.employee_name ?? 'carer'}`;
    case 'assignment.withdrawn': return 'withdrawn';
    case 'settings.updated': return (p.changed ?? []).join(', ') || 'updated';
    case 'timesheet.approved':
    case 'timesheet.locked': return p.starts_on ? `wk ${formatDate(p.starts_on)}` : '—';
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
  };
}

// CQC visit-attendance export: one row per carer × visit over a date range, as
// CSV or XLSX. Lifted onto the Exports tab; self-contained (own date state).
export function VisitAuditExport() {
  const toast = useToast();
  const iso = (d) => d.toISOString().slice(0, 10);
  const [vaFrom, setVaFrom] = useState(iso(new Date(Date.now() - 6 * 86400000)));
  const [vaTo, setVaTo] = useState(iso(new Date()));
  const [vaExporting, setVaExporting] = useState(false);

  const setVaRange = (days) => {
    setVaTo(iso(new Date()));
    setVaFrom(iso(new Date(Date.now() - (days - 1) * 86400000)));
  };

  const downloadVisitAudit = async (type) => {
    setVaExporting(true);
    try {
      // Send full-day bounds so the To date is inclusive.
      await exportAttendanceAudit(`${vaFrom}T00:00:00`, `${vaTo}T23:59:59`, type);
      toast.success(`Visit audit ${type.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setVaExporting(false);
    }
  };

  const dateField = (label, value, onChange) => (
    <label style={s('display:flex;flex-direction:column;gap:4px')}>
      <span style={s('font-size:11px;font-weight:600;color:var(--d-muted)')}>{label}</span>
      <input type="date" value={value} max={vaTo} onChange={(e) => onChange(e.target.value)}
        style={{ ...s('height:38px;border:1px solid var(--d-border);border-radius:10px;background:var(--d-card);color:var(--d-ink);font-size:12.5px;font-weight:500;padding:0 12px'), fontFamily: 'inherit', colorScheme: 'light dark' }} />
    </label>
  );

  return (
    <Panel>
      <PanelTitle hint="One row per carer × visit — scheduled vs actual taps, metres from the client's home, offline flags, lateness and map links. The CQC attendance export.">Visit attendance audit</PanelTitle>
      <div style={s('display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-top:4px')}>
        {dateField('From', vaFrom, setVaFrom)}
        {dateField('To', vaTo, (val) => setVaTo(val < vaFrom ? vaFrom : val))}
        <div style={s('display:flex;gap:6px;align-items:center')}>
          {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map((r) => (
            <button key={r.label} onClick={() => setVaRange(r.days)}
              style={{ ...s('height:32px;padding:0 12px;border:1px solid var(--d-border);border-radius:16px;background:var(--d-card);color:var(--d-ink2);font-size:12px;font-weight:600;cursor:pointer'), fontFamily: 'inherit' }}>{r.label}</button>
          ))}
        </div>
        <div style={s('flex:1')} />
        <Button icon="download" disabled={vaExporting} onClick={() => downloadVisitAudit('csv')}>CSV</Button>
        <Button variant="primary" icon="download" disabled={vaExporting} onClick={() => downloadVisitAudit('xlsx')}>{vaExporting ? 'Building…' : 'Export XLSX'}</Button>
      </div>
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

  useEffect(() => {
    let active = true;
    listAudit({ limit: 100 })
      .then((events) => { if (active) setEntries((events ?? []).map(mapEvent)); })
      .catch(() => { if (active) setEntries([]); });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    if (!entries) return [];
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const q = query.trim().toLowerCase();
    return entries.filter(f.test).filter((e) => (q ? `${e.author} ${e.action} ${e.record} ${e.reason}`.toLowerCase().includes(q) : true));
  }, [entries, filter, query]);

  if (!entries) return <Spinner fullscreen />;

  const byDate = {};
  for (const e of rows) (byDate[e.date] ??= []).push(e);
  const dates = Object.keys(byDate);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:flex;flex-direction:column')}>
        <SegTabs tabs={FILTERS.map((f) => ({ key: f.id, label: f.label, count: entries.filter(f.test).length }))} active={filter} onSelect={setFilter} />
        <div style={s('display:flex;flex-direction:column;gap:14px;margin-top:12px')}>
          <div style={s('display:flex;gap:10px;align-items:center;flex-wrap:wrap')}>
            <div style={s('flex:1;min-width:200px;height:44px;background:var(--d-card);border-radius:22px;display:flex;align-items:center;gap:9px;padding:0 16px')}>
              <Icon name="search" size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search author, record or reason" style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:12.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
            </div>
          </div>

          {dates.length === 0 ? (
            <Panel><div style={s('padding:40px 16px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>No entries match.</div></Panel>
          ) : dates.map((date) => (
        <Panel key={date} padded={false} style={{ padding: '18px 20px' }}>
          <div style={s('font-size:13px;font-weight:700;color:var(--d-ink);margin-bottom:6px')}>{date}</div>
          <TableWrap minWidth={820}>
            <thead><tr><Th>Time</Th><Th>Author</Th><Th>Action</Th><Th>Record</Th><Th>Change</Th><Th>Reason</Th></tr></thead>
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
