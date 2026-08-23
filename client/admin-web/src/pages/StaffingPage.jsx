import { useSearchParams } from 'react-router-dom';
import { s } from '../lib/ui.jsx';
import { SegTabs } from '../ds/console.jsx';
import CoverPage from './CoverPage.jsx';
import RequestsPage from './RequestsPage.jsx';

// Staffing — one home for the two "who's on shift" workflows that used to be
// separate nav items: Cover (visits with no carer, which you assign or offer)
// and Requests (carer-raised drops to approve). They
// are related — a carer dropping a shift creates an unfilled visit — so a
// coordinator manages both here. Same tabbed pattern as Exceptions.
//
// Each tab renders the existing page unchanged; ?tab= keeps deep-links working
// (Cover has no param; Requests is ?tab=requests).
const AREA_TABS = [
  { key: 'cover', label: 'Cover', icon: 'refresh' },
  { key: 'requests', label: 'Requests', icon: 'note' },
];

export default function StaffingPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab = raw === 'requests' ? 'requests' : 'cover';

  const select = (key) => {
    const next = new URLSearchParams(params);
    if (key === 'cover') next.delete('tab');
    else next.set('tab', key);
    setParams(next, { replace: true });
  };

  return (
    <div style={s('display:flex;flex-direction:column;gap:12px')}>
      <span data-tour="staffing-tabs"><SegTabs tabs={AREA_TABS} active={tab} onSelect={select} /></span>
      <div style={s('background:var(--d-panel);padding:16px;border-radius:20px')}>
        {tab === 'requests' ? <RequestsPage /> : <CoverPage />}
      </div>
    </div>
  );
}
