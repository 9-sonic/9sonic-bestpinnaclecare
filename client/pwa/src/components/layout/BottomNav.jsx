import { NavLink, useLocation } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { NAV_TABS } from './navConfig.js';
import { tapFeedback } from '../../utils/haptics.js';
import { prefetchRoute } from '../../utils/prefetch.js';

// Mobile tab bar. Every tab is equal: a wave rides along the top edge of the bar
// and comes to rest under whichever one is active, whose icon lifts up onto a
// filled circle. The wave is placed from the active tab's index rather than by
// measuring the DOM, so it stays correct through resizes without a listener.
export default function BottomNav({ messagesUnread = 0 }) {
  const { pathname } = useLocation();
  // startsWith, so a deeper route like /clock/history keeps its tab lit.
  const activeIndex = NAV_TABS.findIndex((tab) => pathname.startsWith(tab.to));

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {activeIndex >= 0 && (
        <span
          className="bottom-nav__wave"
          aria-hidden="true"
          style={{ '--nav-active': activeIndex }}
        >
          {/* The crest is a real circular arc, concentric with the disc behind
              the active icon, so the hump reads as the bar making room for the
              circle rather than as a bell that happens to sit near it.

              The viewBox is in CSS pixels and .bottom-nav__wave is sized to
              match it exactly, 1:1. That is load-bearing, not tidiness: this
              used to be a 160x26 box stretched with preserveAspectRatio="none",
              which scaled x and y by different factors and turned any circle
              into an ellipse. If the CSS width and height stop matching these
              numbers, the arc stops being circular.

              Geometry, measured off the rendered bar:
                baseline y=26 is the bar's top edge; y=26..28 overlaps into the
                bar so there is no seam. The disc is r=22 centred 7px below the
                bar's top edge, so (60, 33) here. The arc is r=33 about that
                point: an 11px even gap around the disc, and a peak that lands
                on y=0, which is the height the hump already had. The cubics are
                tangent to the arc where they meet it, so the shoulders flow out
                of the circle instead of kinking off it. */}
          <svg viewBox="0 0 120 28" focusable="false">
            <path
              fill="currentColor"
              d="M0,26 C12,26 26,20.95 36,10.35 A33,33 0 0 1 84,10.35 C94,20.95 108,26 120,26 L120,28 L0,28 Z"
            />
          </svg>
        </span>
      )}

      {NAV_TABS.map((tab, index) => {
        const active = index === activeIndex;
        const badge = tab.to === '/messages' ? messagesUnread : (tab.badge ?? 0);

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            onPointerDown={() => prefetchRoute(tab.to)}
            onClick={tapFeedback}
            className={`bottom-nav__link${active ? ' bottom-nav__link--active' : ''}`}
          >
            <span className="bottom-nav__icon">
              <span className="bottom-nav__pill" aria-hidden="true" />
              <Icon name={tab.icon} size={20} strokeWidth={active ? 2.1 : 1.7} />
              {badge > 0 && <span className="bottom-nav__badge">{badge > 9 ? '9+' : badge}</span>}
            </span>
            <span className="bottom-nav__label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
