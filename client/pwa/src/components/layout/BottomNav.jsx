import { NavLink, useLocation } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { NAV_TABS } from './navConfig.js';
import { tapFeedback } from '../../utils/haptics.js';
import { prefetchRoute } from '../../utils/prefetch.js';

// Mobile tab bar. The centre Clock tab is an elevated action button; the other
// four carry a label and an animated active indicator.
export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_TABS.map((tab) => {
        const active = pathname.startsWith(tab.to);

        if (tab.fab) {
          // The raised button is positioned rather than laid out, so it needs
          // a wrapper to hold its column open. Without one the remaining tabs
          // collapse leftwards into the gap and the labels end up under the
          // wrong icons.
          return (
            <span key={tab.to} className="bottom-nav__slot">
              <NavLink
                to={tab.to}
                aria-label={tab.label}
                onPointerDown={() => prefetchRoute(tab.to)}
                onClick={tapFeedback}
                className={`bottom-nav__fab${active ? ' bottom-nav__fab--active' : ''}`}
              >
                <span className="bottom-nav__fab-ring" aria-hidden="true" />
                <Icon name={tab.icon} size={22} strokeWidth={2} />
              </NavLink>
              <span className="bottom-nav__fab-label">{tab.label}</span>
            </span>
          );
        }

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            onPointerDown={() => prefetchRoute(tab.to)}
            onClick={tapFeedback}
            className={`bottom-nav__link${active ? ' bottom-nav__link--active' : ''}`}
          >
            <span className="bottom-nav__dot" aria-hidden="true" />
            <Icon name={tab.icon} size={20} strokeWidth={active ? 2.1 : 1.7} />
            <span className="bottom-nav__label">{tab.label}</span>
            {tab.badge > 0 && <span className="bottom-nav__badge">{tab.badge}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}
