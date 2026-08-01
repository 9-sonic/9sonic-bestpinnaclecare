import { NavLink } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import Avatar from '../common/Avatar.jsx';
import { NAV_TABS, SECONDARY_LINKS } from './navConfig.js';
import { useAuth } from '../../hooks/useAuth.js';

// Desktop-only sidebar. On wide screens a bottom tab bar wastes the space and
// feels wrong, so the same destinations move into a persistent rail.
export default function SideNav() {
  const { user } = useAuth();

  return (
    <aside className="side-nav" aria-label="Main navigation">
      <div className="side-nav__brand">
        <img src="/logo.png" alt="" className="side-nav__logo" />
        <span className="side-nav__brand-text">Pinnacle Care</span>
      </div>

      <nav className="side-nav__group">
        {NAV_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `side-nav__link${isActive ? ' side-nav__link--active' : ''}`
            }
          >
            <Icon name={tab.icon} size={19} />
            <span>{tab.label === 'Chats' ? 'Messages' : tab.label}</span>
          </NavLink>
        ))}
      </nav>

      <p className="side-nav__label">More</p>
      <nav className="side-nav__group">
        {SECONDARY_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `side-nav__link${isActive ? ' side-nav__link--active' : ''}`
            }
          >
            <Icon name={link.icon} size={19} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="side-nav__footer">
        <Avatar name={user?.name ?? ''} src={user?.avatar} size={34} />
        <span className="side-nav__user">
          <span className="side-nav__user-name">{user?.name}</span>
          <span className="side-nav__user-role">{user?.role}</span>
        </span>
      </div>
    </aside>
  );
}
