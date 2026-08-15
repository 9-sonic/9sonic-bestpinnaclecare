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
          <svg viewBox="0 0 119 26" preserveAspectRatio="none" focusable="false">
            <path
              fill="currentColor"
              d="M120.8,26C98.1,26,86.4,0,60.4,0C35.9,0,21.1,26,0.5,26H120.8z"
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
