import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import Avatar from '../common/Avatar.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useHistoryOverlay } from '../../hooks/useHistoryOverlay.js';
import { useScrollLock } from '../../hooks/useScrollLock.js';
import { tapFeedback } from '../../utils/haptics.js';

const SECTIONS = [
  {
    label: 'Work',
    items: [
      { icon: 'home', label: 'Home', to: '/home' },
      { icon: 'calendar', label: 'My shifts', to: '/shifts' },
      { icon: 'clock', label: 'Clock in and out', to: '/clock' },
      { icon: 'trend', label: 'Weekly overview', to: '/overview' },
    ],
  },
  {
    label: 'Account',
    items: [
      { icon: 'user', label: 'My profile', to: '/profile' },
      { icon: 'file', label: 'Personal details', to: '/profile/details' },
      // Availability is not surfaced for now, matching the Profile screen,
      // which dropped its own row earlier for the same reason. The route, the
      // screen and its route test all still exist, so uncommenting this line
      // is the only change needed to bring it back.
      // { icon: 'calendar', label: 'Availability', to: '/profile/availability' },
      { icon: 'settings', label: 'Preferences', to: '/profile/preferences' },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: 'bell', label: 'Notifications', to: '/notifications' },
      { icon: 'chat', label: 'Messages', to: '/messages' },
      { icon: 'help', label: 'Help and support', to: '/help' },
    ],
  },
];

// Slide in menu opened by the header hamburger. Gives one place to reach every
// destination, including the screens that are not on the tab bar.
export default function MenuDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const panelRef = useRef(null);

  // Back closes the drawer rather than leaving the screen.
  const { release } = useHistoryOverlay(open, onClose);
  // The shared lock also stops the page behind scrolling on iOS, which the
  // body overflow trick below never reliably did.
  useScrollLock(open);

  const previouslyFocused = useRef(null);

  // Close on Escape, lock background scroll, and keep focus inside the panel.
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const focusTimer = setTimeout(() => panelRef.current?.querySelector('button')?.focus(), 60);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Hand the drawer's history entry to the destination rather than unwinding
  // it. Closing normally schedules a history.back(), which would fire after
  // this navigation and bounce straight back to where we started.
  const go = (to) => {
    tapFeedback();
    release();
    onClose();
    navigate(to, { replace: true });
  };

  // Portalled for the same reason as Modal: inside the page tree an ancestor
  // animation or containment can move or clip it.
  return createPortal(
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer__head">
          <Avatar name={user?.name ?? ''} src={user?.avatar} size={44} />
          <div className="drawer__who">
            <span className="drawer__name">{user?.name}</span>
            <span className="drawer__role">{user?.role}</span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close menu">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="drawer__scroll">
          {SECTIONS.map((section) => (
            <div key={section.label} className="drawer__section">
              <p className="drawer__label">{section.label}</p>
              {section.items.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  className="drawer__item"
                  onClick={() => go(item.to)}
                >
                  <Icon name={item.icon} size={19} />
                  <span>{item.label}</span>
                  <Icon name="chevronRight" size={16} />
                </button>
              ))}
            </div>
          ))}

          <div className="drawer__section">
            <p className="drawer__label">Display</p>
            <div className="drawer__item drawer__item--static">
              <Icon name="moon" size={19} />
              <span>Dark mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={dark}
                aria-label="Dark mode"
                className={`switch${dark ? ' switch--on' : ''}`}
                onClick={toggle}
              >
                <span className="switch__knob" />
              </button>
            </div>
          </div>
        </div>

        <button type="button" className="drawer__logout" onClick={logout}>
          <Icon name="logout" size={18} />
          Log out
        </button>
      </div>
    </div>,
    document.body
  );
}

