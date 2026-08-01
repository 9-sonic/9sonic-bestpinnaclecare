import { useEffect } from 'react';

// Stops the page behind an overlay from scrolling.
//
// `overflow: hidden` on the body is the usual advice and is not enough on a
// phone. iOS Safari happily scrolls the body anyway, and even where it works
// the page silently jumps to the top when the lock is released because the
// scroll position was discarded.
//
// So: record the position, pin the body there with fixed positioning, and put
// it back on release. The width is held explicitly because a fixed body
// collapses to its content otherwise, which makes the layout jump sideways as
// the sheet opens.

let locks = 0;
let saved = { y: 0, style: null };

export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;

    // Nested overlays share one lock, so the innermost closing does not
    // release the page while an outer one is still open.
    locks += 1;
    if (locks === 1) {
      saved.y = window.scrollY;
      const { body } = document;
      saved.style = {
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        overflow: body.style.overflow,
      };
      body.style.position = 'fixed';
      body.style.top = `-${saved.y}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }

    return () => {
      locks -= 1;
      if (locks > 0) return;
      const { body } = document;
      body.style.position = saved.style?.position ?? '';
      body.style.top = saved.style?.top ?? '';
      body.style.width = saved.style?.width ?? '';
      body.style.overflow = saved.style?.overflow ?? '';
      // Instant, because an animated restore looks like the page jumping.
      window.scrollTo({ top: saved.y, behavior: 'instant' });
    };
  }, [active]);
}

export default useScrollLock;
