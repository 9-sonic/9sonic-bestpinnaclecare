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

  // Hands the pushed entry over to the caller instead of unwinding it.
  //
  // Needed when closing the overlay *and* navigating in the same breath, as the
  // menu drawer does. Without it the cleanup's history.back() fires after the
  // navigation and undoes it, so tapping a menu item appeared to do nothing.
  // The caller navigates with `replace: true`, so the destination takes over
  // the slot this overlay was occupying and the stack stays balanced.
  const release = useRef(() => {
    clearTimeout(unwindRef.current);
    unwindRef.current = null;
    pushedRef.current = false;
  }).current;

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
          // Belt and braces alongside release(): if something else already
          // navigated in the time between this overlay closing and this timeout
          // running — a caller that closes and routes away in the same handler,
          // without going through release() first — our entry is no longer on
          // top of the stack. history.back() at that point would pop whatever
          // the navigation just pushed instead of our own entry, undoing it, so
          // "go to profile" from a modal footer would flash to /profile and
          // immediately bounce back to the screen behind the modal. Only unwind
          // when we can see our own marker still sitting on top.
          if (window.history.state?.bpcOverlay) {
            window.history.back();
          }
        }
      }, 0);
    };
    // Unmounting with the overlay open runs this same cleanup, so the entry is
    // tidied up there too. A second unmount-only effect would race with this
    // one under StrictMode and pop the entry out from under the overlay.
  }, [open]);

  return { release };
}

export default useHistoryOverlay;
