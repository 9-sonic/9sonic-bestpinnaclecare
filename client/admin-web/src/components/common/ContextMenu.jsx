import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';

/* ---------- right-click quick-action menu ---------- */
// Rendered at the cursor. Closes on any outside click, scroll, or Escape.
// `items` is [{ label, icon, danger, onClick }]; a null item is a divider.
// Shared by the rota grid and the messages thread so a right-click behaves the
// same everywhere in the console.
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  // Start at the cursor; after render, measure the real menu box and nudge it
  // back inside the viewport so it never runs off the bottom or right edge.
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const M = 8; // keep a small gap from the edge
    setPos({
      left: Math.max(M, Math.min(x, window.innerWidth - width - M)),
      top: Math.max(M, Math.min(y, window.innerHeight - height - M)),
    });
  }, [x, y, items]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const { left, top } = pos;

  return (
    <div ref={ref} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
      style={{ ...s('position:fixed;z-index:200;width:200px;background:var(--d-card);border:1px solid var(--d-border);border-radius:14px;box-shadow:0 18px 44px rgba(0,0,0,0.26);padding:6px'), left, top, fontFamily: "'Figtree', system-ui, sans-serif" }}>
      {items.filter(Boolean).length === 0 ? null : items.map((it, i) => (it === null ? (
        <div key={`d-${i}`} style={s('height:1px;background:var(--d-border);margin:5px 8px')} />
      ) : (
        <div key={it.label} className="hv"
          onClick={() => { onClose(); it.onClick(); }}
          style={{ ...s('display:flex;align-items:center;gap:10px;height:38px;padding:0 12px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600'), color: it.danger ? 'var(--d-danger-ink)' : 'var(--d-ink)', '--hbg': it.danger ? 'var(--d-danger-bg)' : 'var(--d-panel)' }}>
          <Icon name={it.icon} size={16} />{it.label}
        </div>
      )))}
    </div>
  );
}
