import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { s } from '../lib/ui.jsx';
import { SegTabs } from '../ds/console.jsx';
import OverviewTab from './ReportsPage.jsx';
import ChangeLogTab, { SignInsTab } from './AuditPage.jsx';

// Reporting hub — Overview (KPIs + charts), Change log (the append-only audit
// trail) and Sign-ins (login history) under one nav item, grouped by what you're
// producing rather than by page. Each download lives on the tab whose data it
// exports (report pack on Overview, audit exports on Change log) rather than in a
// separate Exports tab. The active tab lives in the URL (?tab=changelog|signins)
// so refresh, back and deep-links behave. The former /audit and /reports routes
// still resolve here.
const TABS = [
  { key: 'overview', label: 'Overview', icon: 'trend' },
  { key: 'changelog', label: 'Change log', icon: 'file' },
  { key: 'signins', label: 'Sign-ins', icon: 'shield' },
];
const KEYS = TABS.map((t) => t.key);

export default function ReportsHub() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const raw = params.get('tab');
  // ?tab is the single source of truth once set. With no param, /audit deep-links
  // open the Change log and everything else opens Overview.
  const fallback = pathname === '/audit' ? 'changelog' : 'overview';
  const tab = KEYS.includes(raw) ? raw : fallback;
  const [range, setRange] = useState('week');

  // Always write an explicit ?tab (including overview) so selecting a tab can't
  // collide with the /audit pathname fallback — clearing the param would send
  // /audit back to Change log and trap Overview.
  const select = (key) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    setParams(next, { replace: true });
  };

  return (
    <div style={s('display:flex;flex-direction:column;gap:12px')}>
      <span data-tour="reports-tabs"><SegTabs tabs={TABS} active={tab} onSelect={select} /></span>
      <div data-tour="reports-content" style={s('background:var(--d-panel);padding:16px;border-radius:20px')}>
        {tab === 'changelog' ? <ChangeLogTab />
          : tab === 'signins' ? <SignInsTab />
            : <OverviewTab range={range} setRange={setRange} />}
      </div>
    </div>
  );
}
