import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import NotificationsBell from '../common/NotificationsBell.jsx';
import TourLauncher from '../common/TourLauncher.jsx';
import CommandPalette from '../common/CommandPalette.jsx';
import { s, px } from '../../lib/ui.jsx';
import { subscribeInbox } from '../../lib/cable.js';
import { playSound } from '../../lib/sounds.js';
import { uploadMyAvatar } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import TourRoot from '../../tour/TourRoot.jsx';
import PushOptInBanner from '../common/PushOptInBanner.jsx';
import '../../styles/design-shell.css';

// Icon-only rail (tooltip on hover), carrying the full manager-console IA.
// Sections without their own backend yet are marked preview and render a
// Sidebar, grouped top→bottom by how the office actually works a day:
//   overview → live operations → planning & records → people → insight → help.
// Dividers (a null entry) separate the groups visually on the rail.
const NAV = [
  { to: '/', label: 'Live board', icon: 'target', end: true, tour: 'liveboard' },
  null,
  { to: '/exceptions', label: 'Exceptions', icon: 'alert', tour: 'exceptions' },
  { to: '/staffing', label: 'Staffing', icon: 'refresh', tour: 'staffing' },
  null,
  { to: '/rota', label: 'Rota', icon: 'calendar', tour: 'rota' },
  { to: '/timesheets', label: 'Timesheets', icon: 'wallet', tour: 'timesheets' },
  null,
  { to: '/clients', label: 'Clients', icon: 'user', tour: 'clients' },
  { to: '/employees', label: 'Employees', icon: 'users', tour: 'employees' },
  null,
  { to: '/messages', label: 'Messages', icon: 'chat', tour: 'messages' },
  { to: '/reports', label: 'Reports', icon: 'trend', tour: 'reports' },
  null,
  { to: '/settings', label: 'Settings', icon: 'settings', tour: 'settings' },
  { to: '/guide', label: 'Guide', icon: 'info', tour: 'guide' },
];

const TITLE = {
  '/': 'Live board',
  '/lifecycle': 'Lifecycle',
  '/exceptions': 'Exceptions',
  '/alerts': 'Alerts',
  '/staffing': 'Staffing',
  '/cover': 'Staffing',
  '/requests': 'Staffing',
  '/timesheets': 'Timesheets',
  '/rota': 'Rota',
  '/clients': 'Clients',
  '/service-users': 'Clients',
  '/employees': 'Employees',
  '/team': 'Team',
  '/messages': 'Messages',
  '/audit': 'Reports',
  '/reports': 'Reports',
  '/guide': 'Guide',
  '/settings': 'Settings',
};

export default function AdminLayout() {
  const { admin, logout, refreshAdmin } = useAuth();
  const avatarInput = useRef(null);
  async function onAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { await uploadMyAvatar(file); await refreshAdmin?.(); } catch { /* ignore */ }
  }
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Hover label for the icon rail. Rendered position:fixed OUTSIDE the rail so
  // the scrolling rail can never clip it (overflow-y:auto forces overflow-x to
  // clip too — a child pill always gets cut off). { label, y } or null.
  const [railHover, setRailHover] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // App-wide inbox listener: distinct cues so the office can tell a new chat
  // message from a system notification without looking. Runs everywhere (not
  // just the Messages page) since the layout is always mounted.
  useEffect(() => {
    const off = subscribeInbox((payload) => {
      if (!payload?.type) return;
      if (payload.type === 'message') {
        const m = payload.message;
        const fromMe = m?.sender_type === 'Admin' && m?.sender_id === admin?.id;
        if (!fromMe) playSound('message');
      } else if (payload.type === 'notification' || payload.type === 'alert') {
        playSound('notification');
      }
    });
    return off;
  }, [admin?.id]);


  const isOn = (to, end) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  // Reports absorbed the Audit page (still reachable at /audit), so its rail item
  // lights up on both paths.
  const navActive = (item) => {
    if (item.to === '/reports') return isOn('/reports') || pathname === '/audit';
    // Staffing absorbed Cover + Requests (still reachable at those paths).
    if (item.to === '/staffing') return isOn('/staffing') || pathname === '/cover' || pathname === '/requests';
    return isOn(item.to, item.end);
  };
  // Detail/sub-pages (e.g. /employees/:id, /clients/:id) get a Back control in
  // the top bar instead of one inside each page. backTo is the parent list; null
  // on top-level pages, where no Back is shown.
  const BACK_TO = [
    [/^\/employees\/[^/]+$/, '/employees', 'Employees'],
    [/^\/clients\/[^/]+$/, '/clients', 'Clients'],
    [/^\/service-users\/[^/]+$/, '/clients', 'Clients'],
    [/^\/profile$/, '/', 'Profile'],
  ];
  const backMatch = BACK_TO.find(([re]) => re.test(pathname));
  const backTo = backMatch?.[1] ?? null;
  const title = TITLE[pathname] ?? backMatch?.[2] ?? 'Best Pinnacle Care';
  const initials = `${admin?.first_name?.[0] ?? ''}${admin?.last_name?.[0] ?? ''}`.toUpperCase();

  const railBtn = (active) => ({
    ...s('width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none'),
    background: active ? 'var(--d-pill)' : 'var(--d-card)',
    color: active ? 'var(--d-pill-ink)' : 'var(--d-ink2)',
    '--hbg': 'var(--d-card-hover)',
  });

  return (
    <TourRoot>
    <div
      style={{
        ...s('height:100vh;display:flex;background:var(--d-bg);overflow:hidden'),
        fontFamily: "'Figtree', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Rail */}
      <div style={s('width:84px;flex:none;background:var(--d-panel);border-right:1px solid var(--d-border);display:flex;flex-direction:column;align-items:center;padding:18px 0 24px')}>
        <div style={s('width:54px;height:54px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;border:1px solid var(--d-border)')}>
          <img src="/logo.png" alt="Best Pinnacle Care" style={s('width:38px;height:38px;object-fit:contain')} />
        </div>

        <div style={s('height:26px;flex:none')} />

        <div className="rail-nav" style={s('flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:8px;padding:2px 0')}>
          {NAV.map((item, i) => {
            if (item === null) return <div key={`div-${i}`} style={s('width:28px;height:1px;background:var(--d-border);margin:3px 0;flex:none')} />;
            const active = navActive(item);
            return (
              <div
                key={item.to}
                data-tour={`nav-${item.tour}`}
                onClick={() => navigate(item.to)}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setRailHover({ label: item.label, y: r.top + r.height / 2, x: r.right });
                }}
                onMouseLeave={() => setRailHover(null)}
                className={`rail-item${active ? '' : ' hv'}`}
                style={railBtn(active)}
              >
                <Icon name={item.icon} size={px(22)} />
              </div>
            );
          })}
        </div>

        {/* Account actions — pinned at the rail bottom: theme toggle only.
            (Sign out lives in the top bar next to the profile.) */}
        <div style={s('flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:12px;margin-top:8px;border-top:1px solid var(--d-border);width:54px')}>
          <div
            onClick={toggle}
            onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setRailHover({ label: dark ? 'Light mode' : 'Dark mode', y: r.top + r.height / 2, x: r.right }); }}
            onMouseLeave={() => setRailHover(null)}
            title={dark ? 'Light mode' : 'Dark mode'}
            className="hv"
            style={{ ...railBtn(false), width: 40, height: 40 }}
          >
            <Icon name={dark ? 'sun' : 'moon'} size={19} />
          </div>
        </div>
      </div>

      {/* Main */}
      <main style={s('flex:1;min-width:0;height:100vh;overflow:auto;display:flex;flex-direction:column;padding:20px 24px;gap:18px')}>
        {/* Top bar: Back (on sub-pages) · a centred search · notifications, profile
            and sign out on the right. */}
        <div style={s('height:70px;flex:none;background:var(--d-panel);border-radius:24px;display:flex;align-items:center;padding:0 14px 0 18px;gap:12px')}>
          {backTo && (
            <div onClick={() => navigate(backTo)} title="Back" className="hv"
              style={{ ...s('height:40px;border-radius:20px;background:var(--d-card);display:flex;align-items:center;gap:7px;padding:0 15px 0 12px;cursor:pointer;color:var(--d-ink2);font-size:13px;font-weight:700;flex:none'), '--hbg': 'var(--d-card-hover)' }}>
              <Icon name="chevronLeft" size={16} /> Back
            </div>
          )}
          <div style={s('flex:1')} />

          {/* ⌘K search — centred, roomier, with a clear input affordance. */}
          <div onClick={() => setPaletteOpen(true)} className="topbar-search" title="Search (⌘K)"
            style={{ ...s('height:46px;border-radius:23px;background:var(--d-field);border:1.5px solid var(--d-border);display:flex;align-items:center;gap:11px;padding:0 8px 0 18px;cursor:text;width:min(480px,44vw)') }}>
            <Icon name="search" size={18} />
            <span style={s('flex:1;font-size:13.5px;font-weight:500;color:var(--d-muted)')}>Search carers, clients, pages…</span>
            <kbd style={s('font-size:11px;font-weight:700;color:var(--d-ink2);background:var(--d-card);border:1px solid var(--d-border);border-radius:8px;padding:3px 8px')}>⌘K</kbd>
          </div>

          <div style={s('flex:1')} />

          <TourLauncher />

          <NotificationsBell />

          {/* Avatar — profile link. Click the small badge to change your photo. */}
          <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatarPick} />
          <div onClick={() => navigate('/profile')} title="Your profile" className="hv"
            style={{ ...s('height:46px;border-radius:24px;background:var(--d-card);display:flex;align-items:center;gap:11px;padding:0 14px 0 6px;cursor:pointer;color:var(--d-ink);flex:none'), '--hbg': 'var(--d-card-hover)' }}>
            <div onClick={(e) => { e.stopPropagation(); avatarInput.current?.click(); }} title="Change your photo"
              style={s('width:34px;height:34px;border-radius:50%;overflow:hidden;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center')}>
              {admin?.avatar_url
                ? <img src={admin.avatar_url} alt="" style={s('width:34px;height:34px;object-fit:cover;display:block')} />
                : <div style={s('width:34px;height:34px;background:var(--d-pill);color:var(--d-pill-ink);display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700')}>{initials || 'BP'}</div>}
            </div>
            <div style={s('font-size:13.5px;font-weight:600;letter-spacing:-0.1px;white-space:nowrap')}>{admin?.full_name ?? 'Account'}</div>
          </div>

          {/* Sign out — moved here from the rail. */}
          <div onClick={async () => { await logout(); navigate('/login'); }} title="Sign out" className="hv"
            style={{ ...s('width:46px;height:46px;border-radius:23px;background:var(--d-card);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-danger-dot);flex:none'), '--hbg': 'var(--d-danger-bg)' }}>
            <Icon name="logout" size={19} />
          </div>
        </div>

        {/* Page title — its own heading row directly under the nav bar. Sits tight
            to the bar above and close to the content below (negative bottom margin
            cancels most of the main gap) so it reads as the page heading. */}
        <div style={s('flex:none;padding:2px 6px;margin-bottom:-8px')}>
          <div style={s('font-size:28px;font-weight:700;letter-spacing:-0.6px;color:var(--d-ink)')}>{title}</div>
        </div>

        {/* One-time nudge to enable push — shows only for admins who haven't
            decided yet, above the page content. Self-hides otherwise. */}
        <PushOptInBanner />

        {/* Page content — the office pages render here, unchanged */}
        <div style={s('flex:1;min-height:0')}>
          <Outlet />
        </div>
      </main>

      {/* Rail hover label — position:fixed at the app root so the scrolling rail
          can't clip it. Follows the hovered icon's vertical centre. */}
      {railHover && (
        <div
          style={{
            ...s('position:fixed;z-index:200;pointer-events:none;background:var(--d-ink);color:var(--d-card);font-size:12.5px;font-weight:700;padding:7px 13px;border-radius:10px;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,0.25)'),
            left: `${railHover.x + 12}px`,
            top: `${railHover.y}px`,
            transform: 'translateY(-50%)',
          }}
        >
          {railHover.label}
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
    </TourRoot>
  );
}
