import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';
import { usePageTour } from '../../tour/TourRoot.jsx';

// "Show me around" — a small navbar button that starts the guided tour for the
// CURRENT page. Hides itself on pages that have no tour. Must render inside the
// TourProvider (it does — it lives in the AdminLayout top bar).
export default function TourLauncher() {
  const { start, available } = usePageTour();
  if (!available) return null;
  return (
    <div
      onClick={start}
      title="Show me around this page"
      className="hv"
      style={{ ...s('height:40px;border-radius:20px;background:var(--d-card);display:flex;align-items:center;gap:7px;padding:0 14px;cursor:pointer;color:var(--d-ink2);font-size:13px;font-weight:700;flex:none'), '--hbg': 'var(--d-card-hover)' }}
    >
      <Icon name="info" size={16} /> Show me around
    </div>
  );
}
