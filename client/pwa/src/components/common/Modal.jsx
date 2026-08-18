import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { useHistoryOverlay } from '../../hooks/useHistoryOverlay.js';
import { useScrollLock } from '../../hooks/useScrollLock.js';

// Overlay dialog. A bottom sheet on phones, a centred card on desktop.
//
// Rendered through a portal onto document.body rather than where it sits in the
// tree. That is not tidiness. A dialog left inside the page inherits whatever
// the page does to it: this one was picking up the screen entry animation,
// which put a transform on it, which broke its fixed positioning and pushed the
// buttons below the bottom of the screen where they could not be tapped. On the
// body, no ancestor can move it, clip it or contain it.
//
// It also handles what a dialog has to get right and usually does not: the
// device back button closes it, the page behind cannot scroll, focus is trapped
// and restored, and Escape works.
export default function Modal({ open, onClose, title, children, footer, size = 'default' }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Keep the latest onClose in a ref rather than the effect's dependency array.
  // onClose is nearly always an inline function with a fresh identity on every
  // parent render — and a form re-renders its parent on every keystroke — so
  // depending on it re-ran this whole effect per character typed. The cleanup
  // pulled focus back to whatever was focused before the sheet opened and the
  // re-run then focused the panel's first control (the close button), which on
  // a phone reads as the keyboard shutting after each letter. Same fix as
  // client/admin-web's Modal (80f85a1); this one was missed at the time.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useHistoryOverlay(open, onClose);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    const t = setTimeout(
      () => panelRef.current?.querySelector('input, textarea, button')?.focus(),
      60
    );

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="modal__grabber" aria-hidden="true" />
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={19} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
