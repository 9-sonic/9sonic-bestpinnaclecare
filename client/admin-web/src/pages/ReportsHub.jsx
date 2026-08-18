import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { s } from '../lib/ui.jsx';
import Icon from '../components/common/Icon.jsx';
import Tabs, { panelRadius } from '../ds/Tabs.jsx';
import { Panel, PanelTitle, SegTabs } from '../ds/console.jsx';
import OverviewTab, { RANGES, ReportPackExport } from './ReportsPage.jsx';
import ChangeLogTab, { VisitAuditExport, AuditLogExport, SignInsTab } from './AuditPage.jsx';

// Reporting hub — Overview (KPIs + charts), Change log (the append-only audit
// trail), Sign-ins (login history) and Exports (every download in one place)
// under one nav item, grouped by what you're producing rather than by page.
// Each tab reuses the existing page pieces; the active tab lives in the URL
// (?tab=changelog|signins|exports) so refresh, back and deep-links behave.
// The former /audit and /reports routes still resolve here.
const TABS = [
  { key: 'overview', label: 'Overview', icon: 'trend' },
  { key: 'changelog', label: 'Change log', icon: 'file' },
  { key: 'signins', label: 'Sign-ins', icon: 'shield' },
  { key: 'exports', label: 'Exports', icon: 'download' },
];
const KEYS = TABS.map((t) => t.key);

// One export block: a titled panel wrapping an export-controls component.
function ExportCard({ title, hint, children }) {
  return (
    <Panel>
      <PanelTitle hint={hint}>{title}</PanelTitle>
      <div style={s('margin-top:6px')}>{children}</div>
    </Panel>
  );
}

function ExportsTab() {
  // The report pack follows a range, matching the Overview selector.
  const [range, setRange] = useState('week');
  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <VisitAuditExport />

      <ExportCard title="Report pack" hint="Attendance, punctuality, hours and exceptions for the chosen period — the management summary.">
        <div style={s('display:flex;gap:14px;align-items:center;flex-wrap:wrap')}>
          <SegTabs active={range} onSelect={setRange} tabs={RANGES.map((r) => ({ key: r.id, label: r.label }))} />
          <div style={s('flex:1')} />
          <ReportPackExport range={range} />
        </div>
      </ExportCard>

      <ExportCard title="Change log" hint="The full append-only record of every amendment, approval and assignment — who, what, when and why.">
        <AuditLogExport />
      </ExportCard>

      <div style={s('background:var(--d-note-bg);border-radius:14px;padding:12px 15px;display:flex;align-items:center;gap:10px;font-size:12px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>
        <Icon name="shield" size={15} />
        <span style={s('flex:1;min-width:0')}>Exports carry the append-only record — location at clock moments only, UK-hosted. How it&rsquo;s governed is in the Guide.</span>
      </div>
    </div>
  );
}

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
    <div style={s('display:flex;flex-direction:column')}>
      <span data-tour="reports-tabs"><Tabs tabs={TABS} active={tab} onSelect={select} /></span>
      <div data-tour="reports-content" style={{ ...s('background:var(--d-panel);padding:16px'), borderRadius: panelRadius(TABS, tab) }}>
        {tab === 'changelog' ? <ChangeLogTab />
          : tab === 'signins' ? <SignInsTab />
            : tab === 'exports' ? <ExportsTab />
              : <OverviewTab range={range} setRange={setRange} />}
      </div>
    </div>
  );
}
