import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';

// The one dialog shell for the whole office app: a centred, token-styled modal
// with a title/subtitle header, a scrolling body and an optional footer. Handles
// focus trapping, Escape to close, focus restore and body scroll-lock.
//
// This replaced every hand-rolled overlay (the old right-side drawers and the
// per-page inline modals) so dialogs look and behave the same everywhere.
export default function Modal({ open = true, onClose, title, subtitle, children, footer, wide = false, maxWidth }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Keep the latest onClose in a ref rather than the effect's dependency array.
  // onClose is often an inline function that gets a new identity on every parent
  // render (e.g. re-rendered on every keystroke in a form) — depending on it
  // directly re-ran this whole effect each time, including the initial-focus
  // setTimeout below, which yanked focus back to the modal's first field while
  // typing in a later one.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key === 'Escape') { onCloseRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKeyDown);
    const t = setTimeout(() => panelRef.current?.querySelector('input, select, textarea, button')?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const panelWidth = maxWidth ?? (wide ? 640 : 480);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ ...s('position:fixed;inset:0;background:rgba(15,23,30,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px'), fontFamily: "'Figtree', system-ui, sans-serif" }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        style={{ ...s('width:100%;max-height:88vh;background:var(--d-card);border-radius:22px;display:flex;flex-direction:column;overflow:hidden'), maxWidth: `${panelWidth}px` }}
      >
        {(title || subtitle) && (
          <div style={s('padding:20px 24px 15px;border-bottom:1px solid var(--d-border);display:flex;align-items:flex-start;gap:12px;flex:none')}>
            <div style={s('flex:1;min-width:0')}>
              {title && <div style={s('font-size:18px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>{title}</div>}
              {subtitle && <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);margin-top:3px')}>{subtitle}</div>}
            </div>
            <div onClick={onClose} className="hv" style={{ ...s('width:34px;height:34px;border-radius:50%;background:var(--d-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--d-ink2);flex:none'), '--hbg': 'var(--d-sage)' }}>
              <Icon name="close" size={16} />
            </div>
          </div>
        )}
        <div style={s('flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column')}>{children}</div>
        {footer && <div style={s('padding:14px 24px;border-top:1px solid var(--d-border);flex:none')}>{footer}</div>}
      </div>
    </div>
  );
}
