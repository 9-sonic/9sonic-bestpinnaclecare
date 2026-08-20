import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';
import { listEmployees, listServiceUsers } from '../../api/index.js';
import { fullName, addressOf } from '../../api/format.js';

// ⌘K search over the console: static pages plus carers and clients loaded from
// the API on first open. Keyboard-navigable; Enter jumps to the page.
const PAGES = [
  ['Live board', '/', 'target'], ['Lifecycle', '/lifecycle', 'sync'],
  ['Exceptions', '/exceptions', 'alert'], ['Alerts', '/alerts', 'bell'],
  ['Staffing', '/staffing', 'refresh'], ['Cover', '/staffing', 'refresh'], ['Requests', '/staffing?tab=requests', 'note'],
  ['Attendance records', '/attendance', 'wallet'], ['Rota', '/rota', 'calendar'],
  ['Clients', '/clients', 'user'], ['Employees', '/employees', 'users'], ['Messages', '/messages', 'chat'],
  ['Audit', '/audit', 'file'], ['Reports', '/reports', 'trend'], ['Settings', '/settings', 'settings'],
];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [staff, setStaff] = useState([]);
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) { setQuery(''); setActive(0); return; }
    inputRef.current?.focus();
    if (loaded) return;
    Promise.all([listEmployees().catch(() => []), listServiceUsers().catch(() => [])])
      .then(([e, su]) => { setStaff(e); setClients(su); })
      .finally(() => setLoaded(true));
  }, [open, loaded]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = [];
    const pages = PAGES.filter(([label]) => !q || label.toLowerCase().includes(q))
      .map(([label, to, icon]) => ({ kind: 'page', label, sub: to, icon, to }));
    if (pages.length) groups.push({ title: 'Go to', items: pages });
    if (q) {
      const st = staff.filter((e) => `${e.full_name} ${e.email}`.toLowerCase().includes(q))
        .slice(0, 6).map((e) => ({ kind: 'staff', label: fullName(e), sub: e.role === 'senior_carer' ? 'Senior carer' : 'Carer', icon: 'users', to: '/employees' }));
      if (st.length) groups.push({ title: 'Employees', items: st });
      const cl = clients.filter((c) => `${c.full_name} ${c.reference ?? ''} ${c.postcode ?? ''}`.toLowerCase().includes(q))
        .slice(0, 6).map((c) => ({ kind: 'client', label: fullName(c), sub: addressOf(c), icon: 'user', to: '/clients' }));
      if (cl.length) groups.push({ title: 'Clients', items: cl });
    }
    return groups;
  }, [query, staff, clients]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);

  useEffect(() => { setActive(0); }, [query]);

  function choose(item) {
    if (!item) return;
    navigate(item.to);
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  if (!open) return null;

  let idx = -1;
  return (
    <div onClick={onClose} style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.5);display:flex;align-items:flex-start;justify-content:center;z-index:200;padding:12vh 20px 20px'), fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={s('width:100%;max-width:600px;background:var(--d-card);border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.28);border:1px solid var(--d-border)')}>
        <div style={s('display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--d-border)')}>
          <Icon name="search" size={18} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search carers, clients or pages"
            style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:15px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
          <kbd style={s('font-size:11px;font-weight:700;color:var(--d-muted);background:var(--d-field);border-radius:7px;padding:3px 7px')}>esc</kbd>
        </div>

        <div style={s('max-height:56vh;overflow-y:auto;padding:8px')}>
          {flat.length === 0 ? (
            <div style={s('padding:36px 20px;text-align:center;font-size:13.5px;font-weight:500;color:var(--d-muted)')}>
              {loaded ? 'No matches' : 'Searching…'}
            </div>
          ) : (
            results.map((g) => (
              <div key={g.title} style={s('margin-bottom:6px')}>
                <div style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em;padding:8px 12px 4px')}>{g.title}</div>
                {g.items.map((item) => {
                  idx += 1;
                  const on = idx === active;
                  return (
                    <div key={`${item.kind}-${item.label}-${item.sub}`} onClick={() => choose(item)} onMouseEnter={() => setActive(flat.indexOf(item))}
                      style={{ ...s('display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:13px;cursor:pointer'), background: on ? 'var(--d-panel)' : 'transparent' }}>
                      <div style={{ ...s('width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none'), background: on ? 'var(--d-primary-soft)' : 'var(--d-sage)', color: on ? 'var(--d-primary-deep)' : 'var(--d-muted)' }}>
                        <Icon name={item.icon} size={16} />
                      </div>
                      <div style={s('flex:1;min-width:0')}>
                        <div style={s('font-size:14px;font-weight:600;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{item.label}</div>
                        <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{item.sub}</div>
                      </div>
                      {on && <Icon name="chevronRight" size={16} />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
