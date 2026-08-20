import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';
import { usePageTour } from '../../tour/TourRoot.jsx';

// "Show me around" — a small navbar button that starts the guided tour for the
// CURRENT page. Hides itself on pages that have no tour. Must render inside the
// TourProvider (it does — it lives in the AdminLayout top bar).
export default function TourLauncher() {
  const { start, available } = usePageTour();
  if (!available) return null;
  // Icon-only by default; expands left on hover to reveal the label. The label
  // sits BEFORE the icon so the pill grows leftward (see .tour-launch in admin.css).
  return (
    <button type="button" onClick={start} className="tour-launch" aria-label="Show me around this page" style={{ ...s('border:0;flex:none'), fontFamily: 'inherit' }}>
      <span className="tour-launch__label">Show me around</span>
      <span className="tour-launch__icon"><Icon name="info" size={16} /></span>
    </button>
  );
}
