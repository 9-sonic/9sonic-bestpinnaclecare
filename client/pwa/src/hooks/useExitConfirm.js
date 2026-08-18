import { useCallback, useEffect, useRef } from 'react';

// Back on the home screen asks whether to leave, instead of walking back
// through every screen the carer has already been through.
//
// Same trick as useHistoryOverlay: keep one throwaway entry on the stack while
// home is showing, so the device back button fires popstate here rather than
// navigating. The entry carries a marker in history.state, which is what tells
// the two cases apart:
//
//   landed ON the guard      ordinary back navigation (Shifts -> Home), or an
//                            overlay unwinding its own entry. Stay quiet.
//   popped OFF the guard     back was pressed with home already showing, so
//                            there is nothing further back inside the app
//                            worth going to. Ask about leaving.
//
// Deliberately NOT removed when home unmounts. An earlier shape did that, and
// the cleanup's history.back() landed after the router had pushed the new
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
      if (window.history.state?.bpcExitGuard) return;

      // Re-arm BEFORE the sheet opens, not after it closes.
      //
      // The sheet is a Modal, so it pushes a history entry of its own, and
      // dismissing it pops that entry back off, which fires popstate here
      // again. With the guard already restored underneath, that pop lands on
      // the marker and returns above. Without it, the pop landed on a bare
      // entry and re-asked instantly, so "Stay" and tapping outside both
      // reopened the sheet forever; only the hardware back button appeared to
      // work, and only because the re-ask happened to be a no-op while the
      // sheet was still open.
      guard();
      onAskRef.current?.();
    }

    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [enabled, guard]);
}

export default useExitConfirm;
