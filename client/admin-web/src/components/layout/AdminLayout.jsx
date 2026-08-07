import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import NotificationsBell from '../common/NotificationsBell.jsx';
import CommandPalette from '../common/CommandPalette.jsx';
import { s, px } from '../../lib/ui.jsx';
import { uploadMyAvatar } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import '../../styles/design-shell.css';

// Icon-only rail (tooltip on hover), carrying the full manager-console IA.
// Sections without their own backend yet are marked preview and render a
// "design preview" placeholder — the nav is walkable end to end.
const NAV = [
  { to: '/', label: 'Live board', icon: 'target', end: true },
  { to: '/lifecycle', label: 'Lifecycle', icon: 'sync' },
  { to: '/exceptions', label: 'Exceptions', icon: 'alert' },
  { to: '/alerts', label: 'Alerts', icon: 'bell' },
  { to: '/cover', label: 'Cover', icon: 'refresh' },
  { to: '/requests', label: 'Requests', icon: 'note' },
  { to: '/timesheets', label: 'Timesheets', icon: 'wallet' },
  { to: '/rota', label: 'Rota', icon: 'calendar' },
  { to: '/clients', label: 'Clients', icon: 'user' },
  { to: '/employees', label: 'Staff', icon: 'users' },
  { to: '/messages', label: 'Messages', icon: 'chat' },
  { to: '/audit', label: 'Audit', icon: 'file' },
  { to: '/reports', label: 'Reports', icon: 'trend' },
];

const TITLE = {
  '/': 'Live board',
  '/lifecycle': 'Lifecycle',
  '/exceptions': 'Exceptions',
  '/alerts': 'Alerts',
  '/cover': 'Cover',
  '/requests': 'Requests',
  '/timesheets': 'Timesheets',
  '/rota': 'Rota',
  '/clients': 'Clients',
  '/service-users': 'Clients',
  '/employees': 'Staff',
  '/messages': 'Messages',
  '/audit': 'Audit',
  '/reports': 'Reports',
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
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const isOn = (to, end) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  const title = TITLE[pathname] ?? 'Best Pinnacle Care';
  const initials = `${admin?.first_name?.[0] ?? ''}${admin?.last_name?.[0] ?? ''}`.toUpperCase();

  const railBtn = (active) => ({
    ...s('width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none'),
    background: active ? 'var(--d-pill)' : 'var(--d-card)',
    color: active ? 'var(--d-pill-ink)' : 'var(--d-ink2)',
    '--hbg': 'var(--d-card-hover)',
  });

  const menuRow = {
    ...s('display:flex;align-items:center;gap:11px;height:40px;padding:0 12px;border-radius:12px;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--d-ink)'),
    '--hbg': 'var(--d-panel)',
  };

  return (
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

        <div className="rail-nav" style={s('flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;gap:10px;padding:2px 0')}>
          {NAV.map((item) => {
            const active = isOn(item.to, item.end);
            return (
              <div
                key={item.to}
                onClick={() => navigate(item.to)}
                className={active ? '' : 'hv'}
                title={item.label}
                style={railBtn(active)}
              >
                <Icon name={item.icon} size={px(22)} />
              </div>
            );
          })}
        </div>

      </div>

      {/* Main */}
      <main style={s('flex:1;min-width:0;height:100vh;overflow:auto;display:flex;flex-direction:column;padding:20px 24px;gap:18px')}>
        {/* Top bar */}
        <div style={s('height:74px;flex:none;background:var(--d-panel);border-radius:28px;display:flex;align-items:center;padding:0 16px 0 38px')}>
          <div style={s('font-size:30px;font-weight:500;letter-spacing:-0.5px;color:var(--d-ink)')}>{title}</div>
          <div style={s('flex:1')} />

          {/* ⌘K search */}
          <div onClick={() => setPaletteOpen(true)} className="hv" title="Search (⌘K)"
            style={{ ...s('height:46px;border-radius:23px;background:var(--d-card);display:flex;align-items:center;gap:10px;padding:0 14px;cursor:pointer;margin-right:10px;width:230px'), '--hbg': 'var(--d-card-hover)' }}>
            <Icon name="search" size={17} />
            <span style={s('flex:1;font-size:13px;font-weight:500;color:var(--d-muted)')}>Search…</span>
            <kbd style={s('font-size:11px;font-weight:700;color:var(--d-muted);background:var(--d-field);border-radius:7px;padding:2px 6px')}>⌘K</kbd>
          </div>

          <div style={s('margin-right:10px')}><NotificationsBell /></div>

          <div ref={accountRef} style={s('position:relative')}>
            <div
              className="hv"
              onClick={() => setMenuOpen((v) => !v)}
              title="Account"
              style={{
                ...s('height:46px;border-radius:24px;background:var(--d-card);display:flex;align-items:center;gap:12px;padding:0 14px 0 6px;cursor:pointer;color:var(--d-ink)'),
                '--hbg': 'var(--d-card-hover)',
              }}
            >
              <input ref={avatarInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={onAvatarPick} />
              <div onClick={(e) => { e.stopPropagation(); avatarInput.current?.click(); }} title="Change your photo"
                style={s('width:34px;height:34px;border-radius:50%;overflow:hidden;flex:none;cursor:pointer')}>
                {admin?.avatar_url
                  ? <img src={admin.avatar_url} alt="" style={s('width:34px;height:34px;object-fit:cover;display:block')} />
                  : <div style={s('width:34px;height:34px;background:var(--d-pill);color:var(--d-pill-ink);display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700')}>{initials || 'BP'}</div>}
              </div>
              <div style={s('font-size:13.5px;font-weight:600;letter-spacing:-0.1px')}>{admin?.full_name ?? 'Account'}</div>
              <Icon name="chevronDown" size={16} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </div>

            {menuOpen && (
              <div style={s('position:absolute;top:54px;right:0;width:214px;background:var(--d-card);border-radius:18px;border:1px solid var(--d-border);box-shadow:0 20px 50px rgba(0,0,0,0.22);padding:8px;display:flex;flex-direction:column;gap:2px;z-index:60')}>
                <div onClick={() => { setMenuOpen(false); navigate('/settings'); }} className="hv" style={menuRow}>
                  <Icon name="settings" size={18} /><span>Settings</span>
                </div>
                <div onClick={toggle} className="hv" style={menuRow}>
                  <Icon name={dark ? 'sun' : 'moon'} size={18} /><span>{dark ? 'Light mode' : 'Dark mode'}</span>
                </div>
                <div style={s('height:1px;background:var(--d-border);margin:4px 6px')} />
                <div onClick={async () => { setMenuOpen(false); await logout(); navigate('/login'); }} className="hv" style={{ ...menuRow, color: 'var(--d-danger-dot)' }}>
                  <Icon name="logout" size={18} /><span>Sign out</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page content — the office pages render here, unchanged */}
        <div style={s('flex:1;min-height:0')}>
          <Outlet />
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
