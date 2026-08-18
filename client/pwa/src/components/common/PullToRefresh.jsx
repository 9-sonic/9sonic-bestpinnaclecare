import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { selectFeedback, successFeedback } from '../../utils/haptics.js';

// Pull down at the top of a screen to reload it.
//
// Deliberately hand rolled rather than relying on the browser's own gesture:
// an installed PWA has no address bar to pull, and the native behaviour on
// Android reloads the whole document, which throws away the offline queue and
// every bit of in-memory state. This re-runs the screen's own fetch instead.
//
// The gesture only starts when the page is already scrolled to the very top,
// so it never fights normal scrolling.

const TRIGGER_PX = 72;
const MAX_PULL = 110;
// Below this the pull is treated as an accidental nudge during a scroll.
const START_SLOP = 8;

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null);
  const armed = useRef(false);
  // The actual scrolling element is .app-content, the nearest scrollable
  // ancestor — this component's own wrapper never scrolls. window.scrollY is
  // always 0 here (see global.css: html/body/#root are overflow:hidden so the
  // document itself never moves), so checking it made every pull look like it
  // started at the top even deep in a long list, and the gesture fought
  // ordinary scrolling instead of only firing at the real top. Resolved lazily
  // and cached: .app-content's position relative to this wrapper is fixed for
  // the life of the component, so one DOM walk is enough.
  const root = useRef(null);
  const scroller = useRef(undefined);

  const atTop = () => {
    if (scroller.current === undefined) {
      scroller.current = root.current?.closest('.app-content') ?? window;
    }
    if (scroller.current === window) {
      return (window.scrollY || document.documentElement.scrollTop) <= 0;
    }
    return scroller.current.scrollTop <= 0;
  };

  const finish = useCallback(async () => {
    if (pull >= TRIGGER_PX && !refreshing) {
      setRefreshing(true);
      successFeedback();
      // Hold the indicator at the trigger point while the work happens.
      setPull(TRIGGER_PX);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
    start.current = null;
    armed.current = false;
  }, [pull, refreshing, onRefresh]);

  useEffect(() => {
    if (disabled) return undefined;

    function onStart(e) {
      if (refreshing || !atTop() || e.pointerType === 'mouse') return;
      start.current = e.clientY;
      armed.current = false;
    }

    function onMove(e) {
      if (start.current === null || refreshing) return;
      const delta = e.clientY - start.current;

      // Any upward movement, or leaving the top, cancels the gesture.
      if (delta < 0 || !atTop()) {
        start.current = null;
        setPull(0);
        return;
      }
      if (delta < START_SLOP) return;

      if (!armed.current) {
        armed.current = true;
        selectFeedback();
      }

      // Resistance: the pull slows as it goes, the way a native list does.
      const eased = Math.min(MAX_PULL, (delta - START_SLOP) * 0.5);
      setPull(eased);
    }

    window.addEventListener('pointerdown', onStart, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', finish, { passive: true });
    window.addEventListener('pointercancel', finish, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onStart);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [disabled, refreshing, finish]);

  const ready = pull >= TRIGGER_PX;

  return (
    <div className="ptr" ref={root}>
      <div
        className={`ptr__indicator${refreshing ? ' ptr__indicator--busy' : ''}`}
        style={{ height: pull, opacity: pull > 0 ? 1 : 0 }}
        aria-hidden={pull === 0}
      >
        <span
          className="ptr__icon"
          style={{ transform: `rotate(${Math.min(180, (pull / TRIGGER_PX) * 180)}deg)` }}
        >
          <Icon name={refreshing ? 'sync' : 'arrowDown'} size={18} />
        </span>
        <span className="ptr__label">
          {refreshing ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>

      <div
        className="ptr__content"
        style={{
          transform: pull > 0 ? `translateY(${pull * 0.35}px)` : undefined,
          transition: start.current === null ? 'transform 0.25s cubic-bezier(0.16,1,0.3,1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
