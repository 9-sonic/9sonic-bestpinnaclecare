import { useCallback, useEffect, useRef } from 'react';

// Back on the home screen asks whether to leave, instead of walking back
// through every screen the carer has already been through.
//
// Same trick as useHistoryOverlay: keep one throwaway entry on the stack while
// home is showing, so the device back button fires popstate here rather than
// navigating. The entry carries a marker in history.state, which is what tells
// the two cases apart:
//
//   landed ON the guard      back from a deeper screen (Shifts -> Home). The
//                            marker is present, so this is ordinary back
//                            navigation and nothing is asked.
//   popped OFF the guard     back while home was already showing. The marker
//                            is gone, so there is nothing further back inside
//                            the app worth going to — ask about leaving.
//
// Deliberately NOT removed when home unmounts. An earlier shape did that, and
// the cleanup's history.back() landed *after* the router had pushed the new
// screen, so tapping a tab from home bounced straight back to home. Leaving the
// entry costs one stack slot and breaks nothing: the marker check means
// re-entering home never stacks a second guard.
export function useExitConfirm(enabled, onAsk) {
  const onAskRef = useRef(onAsk);
  onAskRef.current = onAsk;

  const guard = useCallback(() => {
    if (!window.history.state?.bpcExitGuard) {
      window.history.pushState({ bpcExitGuard: true }, '');
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    guard();

    function handlePop() {
      // An overlay closing also pops — but that lands back ON the guard, so the
      // marker is still there and this correctly stays quiet.
      if (!window.history.state?.bpcExitGuard) onAskRef.current?.();
    }

    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [enabled, guard]);

  // Called when the carer backs out of the confirmation. The sheet is a Modal,
  // so useHistoryOverlay is unwinding its own entry on a deferred tick; re-arm
  // after that lands, or the re-pushed guard would be the thing it pops. The
  // marker check makes the timing forgiving rather than exact.
  const rearm = useCallback(() => {
    setTimeout(guard, 120);
  }, [guard]);

  return { rearm };
}

export default useExitConfirm;
