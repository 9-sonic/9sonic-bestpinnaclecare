import { useEffect, useRef } from 'react';

// Makes the device back button close an overlay instead of leaving the screen.
//
// On Android the back gesture is how people dismiss things, so an app that
// navigates away instead of closing the open sheet feels broken. The trick is
// to push a throwaway history entry when the overlay opens: back then pops that
// entry rather than the route, and popstate becomes the signal to close.
//
// Three cases have to be handled or the history stack drifts:
//
//   closed by back     popstate fires, our entry is already gone, just close.
//   closed by the UI   our entry is still on the stack, so remove it with
//                      history.back() and ignore the popstate that causes.
//   StrictMode         React deliberately mounts, unmounts and remounts effects
//                      in development. A naive cleanup pushes an entry then
//                      immediately unwinds it, leaving the overlay open with
//                      nothing behind it, so back exits the screen instead of
//                      closing the sheet. The unwind is therefore deferred by a
//                      tick and cancelled if the effect comes straight back.
//
// Nested overlays work because each pushes its own entry, so back unwinds them
// one at a time in the order they were opened.

export function useHistoryOverlay(open, onClose) {
  const pushedRef = useRef(false);
  const unwindRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    // A remount arriving before the deferred unwind ran means StrictMode is
    // cycling the effect. Keep the entry that is already on the stack.
    if (unwindRef.current !== null) {
      clearTimeout(unwindRef.current);
      unwindRef.current = null;
    } else {
      window.history.pushState({ bpcOverlay: true }, '');
      pushedRef.current = true;
    }

    function handlePop() {
      // The user pressed back, so our entry is already gone. Just close.
      pushedRef.current = false;
      onCloseRef.current?.();
    }

    window.addEventListener('popstate', handlePop);

    return () => {
      window.removeEventListener('popstate', handlePop);

      // Deferred so a StrictMode remount can cancel it. The listener is
      // already detached, so the popstate this triggers is harmless.
      unwindRef.current = setTimeout(() => {
        unwindRef.current = null;
        if (pushedRef.current) {
          pushedRef.current = false;
          window.history.back();
        }
      }, 0);
    };
    // Unmounting with the overlay open runs this same cleanup, so the entry is
    // tidied up there too. A second unmount-only effect would race with this
    // one under StrictMode and pop the entry out from under the overlay.
  }, [open]);
}

export default useHistoryOverlay;
