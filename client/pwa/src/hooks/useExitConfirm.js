import { useCallback, useEffect, useRef } from 'react';

// Back on the home screen warns instead of walking back through every screen
// the carer has already been through, using the same "press back again to
// exit" idiom most Android apps use at the root of their own back stack.
//
// Deliberately not window.close() plus a confirm sheet, which is what this
// used to be. Nothing on the web can reliably close a window it did not open
// itself with window.open() — an installed PWA launched from the home screen
// was opened by the OS, not by script, so browsers refuse the call, usually
// silently. Real exiting only happens one way: the carer's own next back
// press runs out of history for the browser to go back through, and Chrome
// hands that off to Android, which closes the app. This hook's only job is to
// warn once and then get out of the way of that, not to fight it.
//
// Same throwaway history entry trick as useHistoryOverlay: keep one entry on
// the stack while home is showing, so the device back button fires popstate
// here rather than navigating. A marker in history.state tells two cases
// apart: landing ON the guard (an overlay closing and unwinding its own
// entry, or React re-running this effect) is not a back-intent and is
// ignored; popping the guard OFF is a real back press.
export function useExitConfirm(enabled, onWarn) {
  const guard = useCallback(() => {
    if (!window.history.state?.bpcExitGuard) {
      window.history.pushState({ bpcExitGuard: true }, '');
    }
  }, []);

  // onWarn is normally an inline arrow at the call site, a fresh identity
  // every render. Read from a ref rather than the dependency array below, the
  // same reasoning as Modal's onClose fix earlier in this branch: depending on
  // it directly would tear the listener down and re-run guard() on every
  // render of whatever screen calls this, not just on real open/close.
  const onWarnRef = useRef(onWarn);
  onWarnRef.current = onWarn;

  useEffect(() => {
    if (!enabled) return undefined;
    guard();

    // Set while waiting to see if a second press follows the first. Not
    // re-pushed as a guard immediately, on purpose: doing that just traps
    // every following press in an endless warn loop, the same bug fixed in
    // the confirm-sheet version this replaced. Leaving nothing here lets a
    // second, confirming press reach whatever is genuinely behind home,
    // which is what running out of history actually requires.
    let rearmTimer = null;

    function handlePop() {
      if (window.history.state?.bpcExitGuard) return;

      if (rearmTimer) {
        // The second press, arriving inside the window. Stand aside.
        clearTimeout(rearmTimer);
        rearmTimer = null;
        return;
      }

      // The first press. Warn, then restore the guard shortly after so a
      // later, separate press is caught again rather than landing with no
      // warning at all.
      onWarnRef.current?.();
      rearmTimer = setTimeout(() => {
        rearmTimer = null;
        guard();
      }, 2000);
    }

    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      clearTimeout(rearmTimer);
    };
  }, [enabled, guard]);
}

export default useExitConfirm;
