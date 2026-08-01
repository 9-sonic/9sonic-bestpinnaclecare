import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import SideNav from './SideNav.jsx';
import MenuDrawer from './MenuDrawer.jsx';
import StatusBanners from '../common/StatusBanners.jsx';
import PullToRefresh from '../common/PullToRefresh.jsx';
import InstallPrompt from '../common/InstallPrompt.jsx';
import UpdatePrompt from '../common/UpdatePrompt.jsx';
import { useQueueSync } from '../../hooks/useQueueSync.js';
import { useSwipeTabs } from '../../hooks/useSwipeTabs.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { MenuContext } from './MenuContext.js';
import { prefetchTabs } from '../../utils/prefetch.js';

// Shell for the tabbed screens.
// Mobile: content plus a bottom tab bar. Desktop: persistent sidebar.
//
// The content element is deliberately NOT keyed on the route. Keying it forces
// React to tear down and rebuild the whole subtree on every navigation, which
// made the bottom bar repaint and flicker between views.
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Pull to refresh re-mounts the routed screen by changing its key, which
  // re-runs whatever it fetches on mount. That keeps the gesture working for
  // every screen without each one having to expose a reload function.
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(
    () =>
      new Promise((resolve) => {
        setReloadToken((n) => n + 1);
        // Long enough for the screen's own fetch to get going, so the
        // indicator does not vanish before anything visibly changes.
        setTimeout(resolve, 600);
      }),
    []
  );

  // The chat thread manages its own scrolling and would fight the gesture.
  const allowPull = !pathname.startsWith('/messages/');
  useQueueSync();

  // Swiping between tabs only makes sense where the tab bar is: on desktop the
  // sidebar is the navigation and a stray trackpad swipe changing page would
  // be startling.
  const isPhone = useMediaQuery('(max-width: 899px)');
  useSwipeTabs(isPhone);

  // Warm the tab screens once the app is idle, so switching tabs is instant.
  useEffect(() => {
    prefetchTabs();
  }, []);

  return (
    <MenuContext.Provider value={{ openMenu: () => setMenuOpen(true) }}>
      <div className="app-frame">
        <SideNav />
        <div className="app-shell">
          <StatusBanners />
          <main className="app-content">
            <PullToRefresh onRefresh={refresh} disabled={!allowPull}>
              <Outlet key={reloadToken} />
            </PullToRefresh>
          </main>
          <InstallPrompt />
          <UpdatePrompt />
          <BottomNav />
        </div>
        <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    </MenuContext.Provider>
  );
}
