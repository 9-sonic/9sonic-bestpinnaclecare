import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_TABS } from '../components/layout/navConfig.js';
import { selectFeedback } from '../utils/haptics.js';

// Swipe left and right to move between the tab bar destinations.
//
// The fiddly part is not detecting the gesture, it is knowing when to ignore
// it. A swipe should not change tab when the finger started on something that
// scrolls sideways, on a control the user is dragging, or when the movement is
// mostly vertical because they are actually scrolling the page. Each of those
// is checked before the gesture is claimed.
//
// Pointer events are used rather than touch events so it also works with a
// trackpad or a stylus, and so a single code path covers both.

const ORDER = NAV_TABS.map((t) => t.to);

// Distance the finger must travel before this counts as a swipe.
const THRESHOLD_PX = 64;
// Horizontal travel must beat vertical by this much, otherwise it is a scroll.
const DIRECTION_RATIO = 1.6;
// Anything slower than this is a drag, not a swipe.
const MAX_DURATION_MS = 700;
// Ignore gestures that begin at the very edge, where the OS back gesture lives.
const EDGE_GUARD_PX = 18;

function startsInScrollable(target) {
  // Guard non-element targets: a synthetic event, or one dispatched on window,
  // has no computed style and would throw here.
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.dataset?.noSwipe !== undefined) return true;
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
      return true;
    }
    // Interactive controls own their own horizontal drags.
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
    el = el.parentElement;
  }
  return false;
}

export function useSwipeTabs(enabled = true) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const state = useRef(null);
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return undefined;
    // Someone who has asked for less motion should not get screens flying past.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    function onPointerDown(e) {
      if (e.pointerType === 'mouse') return;
      if (e.clientX < EDGE_GUARD_PX || e.clientX > window.innerWidth - EDGE_GUARD_PX) return;
      if (startsInScrollable(e.target)) return;
      state.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    }

    function onPointerUp(e) {
      const start = state.current;
      state.current = null;
      if (!start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Date.now() - start.t > MAX_DURATION_MS) return;
      if (Math.abs(dx) < THRESHOLD_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO) return;

      const index = ORDER.findIndex((to) => pathRef.current.startsWith(to));
      if (index === -1) return;

      // Swiping left moves forward through the tabs, matching the direction
      // the content appears to travel.
      const next = dx < 0 ? index + 1 : index - 1;
      if (next < 0 || next >= ORDER.length) return;

      selectFeedback();
      navigate(ORDER[next]);
    }

    function onPointerCancel() {
      state.current = null;
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerCancel, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [enabled, navigate]);
}

export default useSwipeTabs;
