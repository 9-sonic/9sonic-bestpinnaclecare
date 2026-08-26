import { useCallback, useEffect, useMemo, useState } from 'react';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { listNotes, exportNotes, listServiceUsers, listEmployees } from '../api/index.js';
import { fullName, formatDate, formatTime } from '../api/format.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { Panel, PanelTitle, StatCard, Avatar, Tag, ExportButton, DateField, SelectField, FilterBar, Pager } from '../ds/console.jsx';

// The office-wide care-notes journal: every carer's write-up across every visit,
// filterable by carer AND client together (the per-carer and per-client pages
// each only show one side), plus date range and free-text search. The PDF/Word
// export streams exactly this filtered set (server-side, Notes::Query).
const NOTES_PER_PAGE = 50;
const iso = (d) => d.toISOString().slice(0, 10);
const initials = (name) => (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

// PDF + Word, in place of the default CSV/XLSX pair.
const NOTE_FORMATS = [
  { type: 'pdf', label: 'PDF', hint: 'Print-ready document — one note per block with its date, carer and client.', icon: 'file' },
  { type: 'docx', label: 'Word (DOCX)', hint: 'Editable Word document with the same notes.', icon: 'download' },
];

export default function NotesPage() {
  const toast = useToast();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));
  const [serviceUserId, setServiceUserId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [q, setQ] = useState('');       // committed search term (what we query on)
  const [qInput, setQInput] = useState(''); // live text box value
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rows, setRows] = useState(null); // null = loading
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    Promise.all([listServiceUsers().catch(() => []), listEmployees().catch(() => [])])
      .then(([su, e]) => { setClients(su); setStaff(e); });
  }, []);

  // Debounce the free-text box so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  // Back to page 1 whenever a filter changes, so you never land on an empty page.
  useEffect(() => { setPage(1); }, [from, to, serviceUserId, employeeId, q]);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const r = await listNotes({ from, to, serviceUserId, employeeId, q, page, perPage: NOTES_PER_PAGE });
      setRows(r.items ?? []);
      setTotal(r.total ?? 0);
    } catch { setRows([]); setTotal(0); }
  }, [from, to, serviceUserId, employeeId, q, page]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async (type) => {
    try {
      await exportNotes({ from, to, serviceUserId, employeeId, q }, type);
      toast.success(`${type === 'docx' ? 'Word document' : 'PDF'} downloaded`);
    } catch (e) { toast.error(e.message || 'Export failed'); return false; }
  };

  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, label: fullName(c) })).sort((a, b) => a.label.localeCompare(b.label)), [clients]);
  const staffOptions = useMemo(() => staff.map((e) => ({ id: e.id, label: fullName(e) })).sort((a, b) => a.label.localeCompare(b.label)), [staff]);

  const filtered = serviceUserId || employeeId || q;

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px')}>
        <StatCard label="Notes in range" value={rows === null ? '–' : total} hint={`${formatDate(`${from}T00:00:00`)} – ${formatDate(`${to}T00:00:00`)}`} tone="primary" icon="note" />
        <StatCard label="Client" value={rows === null ? '–' : (serviceUserId ? (clientOptions.find((c) => String(c.id) === String(serviceUserId))?.label ?? '—') : 'All')} hint="Filter by who the visit was for" tone="violet" icon="user" />
        <StatCard label="Carer" value={rows === null ? '–' : (employeeId ? (staffOptions.find((e) => String(e.id) === String(employeeId))?.label ?? '—') : 'All')} hint="Filter by who attended" tone="magenta" icon="users" />
      </div>

      <Panel>
        <PanelTitle>Care notes</PanelTitle>
        <FilterBar style={{ marginTop: 4 }}>
          <DateField label="From" value={from} onChange={setFrom} max={to} />
          <DateField label="To" value={to} onChange={(val) => setTo(val < from ? from : val)} min={from} />
          <SelectField label="Client" value={serviceUserId} onChange={setServiceUserId} options={clientOptions} allLabel="All clients" />
          <SelectField label="Carer" value={employeeId} onChange={setEmployeeId} options={staffOptions} allLabel="All carers" />
          <label style={s('display:flex;flex-direction:column;gap:5px')}>
            <span style={s('font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>Search</span>
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search note text…"
              style={{ ...s('height:38px;border-radius:11px;border:1.5px solid var(--d-border);background:var(--d-card);color:var(--d-ink);font-size:13px;font-weight:600;padding:0 12px;min-width:180px'), fontFamily: 'inherit' }} />
          </label>
          <FilterBar.Spacer />
          <ExportButton onExport={handleExport} formats={NOTE_FORMATS} label="Export notes" title="Export care notes"
            subtitle="Choose a format. The current date range, carer, client and search are applied — the export is exactly what's on screen." />
        </FilterBar>
      </Panel>

      {rows === null ? (
        <Panel style={{ padding: '60px 24px' }}><Spinner /></Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <div style={s('display:flex;flex-direction:column;align-items:center;gap:10px;padding:46px 20px')}>
            <div style={s('width:52px;height:52px;border-radius:16px;background:var(--d-panel);display:flex;align-items:center;justify-content:center;color:var(--d-muted)')}><Icon name="note" size={24} /></div>
            <div style={s('font-size:14px;font-weight:700;color:var(--d-ink2)')}>No notes in this range</div>
            <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{filtered ? 'Try a wider date range, or clear the carer/client/search filters.' : 'Try a wider date range.'}</div>
          </div>
        </Panel>
      ) : (
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((n) => (
            <div key={n.id} style={s('display:flex;flex-direction:column;gap:7px;padding:14px 16px;border:1px solid var(--d-border);border-radius:14px;background:var(--d-card)')}>
              <div style={s('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
                <span style={s('display:inline-flex;align-items:center;gap:8px')}>
                  <Avatar initials={initials(n.employee_name ?? n.author_name ?? '?')} size="sm" />
                  <b style={s('font-weight:700;color:var(--d-ink);font-size:13px')}>{n.employee_name ?? n.author_name ?? 'Unknown'}</b>
                </span>
                <Icon name="chevronRight" size={13} style={{ color: 'var(--d-faint)' }} />
                <span style={s('font-weight:600;color:var(--d-ink2);font-size:13px')}>{n.service_user_name ?? '—'}</span>
                <FilterBar.Spacer />
                {n.visit_scheduled_start && (
                  <span className="d-num" style={s('font-size:11.5px;font-weight:600;color:var(--d-muted)')}>
                    {formatDate(n.visit_scheduled_start)} · {formatTime(n.visit_scheduled_start)}
                  </span>
                )}
                {n.author_type === 'Admin' && <Tag tone="violet">Office edit</Tag>}
              </div>
              <div style={s('font-size:13px;font-weight:500;color:var(--d-ink);line-height:1.55;white-space:pre-wrap')}>{n.body}</div>
            </div>
          ))}
        </Panel>
      )}

      {rows !== null && total > 0 && (
        <div style={s('display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 2px')}>
          <span className="d-num" style={s('font-size:12px;font-weight:600;color:var(--d-muted)')}>{total} note{total === 1 ? '' : 's'} in range</span>
          <Pager page={page} perPage={NOTES_PER_PAGE} total={total} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
