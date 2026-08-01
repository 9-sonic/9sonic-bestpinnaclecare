import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

const NAV = [
  { to: '/', label: 'Today', icon: 'home', end: true },
  { to: '/board', label: 'Live board', icon: 'target' },
  { to: '/rota', label: 'Rota', icon: 'calendar' },
  { to: '/exceptions', label: 'Exceptions', icon: 'alert' },
  { to: '/timesheets', label: 'Timesheets', icon: 'wallet' },
];

const ADMIN_NAV = [
  { to: '/employees', label: 'Staff', icon: 'users' },
  { to: '/service-users', label: 'People we support', icon: 'user' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

const ROLE_LABELS = {
  registered_manager: 'Registered manager',
  manager: 'Manager',
  coordinator: 'Coordinator',
  finance: 'Finance',
  auditor: 'Auditor',
};

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const initials = `${admin?.first_name?.[0] ?? ''}${admin?.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="shell">
      <aside className={`sidebar${navOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <img src="/logo.png" alt="" className="sidebar__logo" />
          <span className="sidebar__brand-text">
            Best Pinnacle
            <span className="sidebar__brand-sub">Office</span>
          </span>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `navlink${isActive ? ' navlink--active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}

          <p className="sidebar__label">Manage</p>
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `navlink${isActive ? ' navlink--active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <button type="button" className="theme-toggle" onClick={toggle}>
            <Icon name={dark ? 'moon' : 'moon'} size={16} />
            {dark ? 'Dark' : 'Light'} mode
          </button>

          <div className="whoami">
            <span className="whoami__avatar">{initials}</span>
            <span className="whoami__text">
              <span className="whoami__name">{admin?.full_name}</span>
              <span className="whoami__role">{ROLE_LABELS[admin?.role] ?? admin?.role}</span>
            </span>
          </div>

          <button
            type="button"
            className="signout"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {navOpen && <div className="sidebar__scrim" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn topbar__burger"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" size={20} />
          </button>
          <img src="/logo.png" alt="Best Pinnacle Care" className="topbar__logo" />
        </div>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
