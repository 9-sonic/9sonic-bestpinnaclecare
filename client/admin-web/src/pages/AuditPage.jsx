import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listAudit, exportAuditLog } from '../api/index.js';
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
const RECORD = { VisitAssignment: 'Visit', TimesheetPeriod: 'Timesheet', Setting: 'Settings', ServiceUser: 'Client', Employee: 'Staff', Visit: 'Visit', Alert: 'Alert' };
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

export default function AuditPage() {
  const toast = useToast();
  const [entries, setEntries] = useState(null); // null = loading
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);

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
            <Button icon="download" disabled={exporting} onClick={async () => { setExporting(true); try { await exportAuditLog({ event_type: filter !== 'all' ? undefined : undefined }, 'csv'); toast.success('Audit CSV downloaded'); } catch (e) { toast.error(e.message || 'Export failed'); } finally { setExporting(false); } }}>CSV</Button>
            <Button icon="download" disabled={exporting} onClick={async () => { setExporting(true); try { await exportAuditLog({}, 'xlsx'); toast.success('Audit XLSX downloaded'); } catch (e) { toast.error(e.message || 'Export failed'); } finally { setExporting(false); } }}>{exporting ? 'Exporting…' : 'XLSX'}</Button>
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

      <Panel>
        <PanelTitle hint="How this data is governed">Compliance notes</PanelTitle>
        <div style={s('display:flex;flex-direction:column;gap:10px')}>
          {[
            'Every entry is append-only. Records are written once and never altered or deleted — a correction adds a new row that points at what it supersedes.',
            'Amendments carry the author, the exact time, and a mandatory reason. The original clock event is always preserved.',
            'Location is captured only at clock moments, never between visits. UK-hosted; UK GDPR and NHS Data Security Standards apply.',
          ].map((t) => (
            <div key={t} style={s('display:flex;gap:11px;align-items:flex-start')}>
              <div style={s('width:22px;height:22px;border-radius:7px;background:var(--d-ok-bg);display:flex;align-items:center;justify-content:center;flex:none;color:var(--d-ok-ink);margin-top:1px')}><Icon name="shield" size={13} /></div>
              <div style={s('font-size:13px;font-weight:500;color:var(--d-ink2);line-height:1.5')}>{t}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
