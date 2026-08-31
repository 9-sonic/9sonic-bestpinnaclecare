import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';

// A small ⓘ icon that reveals a short explanation on hover/focus. Used next to
// action buttons so a control is self-documenting.
//
// The bubble AUTO-FLIPS to stay on-screen: on hover/focus it measures the icon's
// position and opens toward whichever side has room — text flows left when the
// icon is near the right edge, right when near the left edge, and downward when
// near the top. This is why a hint on the left of the screen (or inside a modal)
// no longer clips off the edge. `below`/`align` still let a caller force a side,
// but they're rarely needed now. `maxWidth` caps the bubble for a narrow panel.
export default function InfoHint({ text, label = 'More info', below, align, maxWidth = 240 }) {
  const ref = useRef(null);
  // Resolved placement, decided when the hint is opened. Defaults match the old
  // behaviour until measured.
  const [place, setPlace] = useState({ vertical: below ? 'below' : 'above', horizontal: align || 'right' });

  // Measure and choose the side with room, so the bubble never runs off-screen.
  const decide = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const room = maxWidth + 24; // width the bubble needs plus a gutter
    // Horizontal: flow right (left:0) when the icon is in the left ~40% of the
    // screen or too close to the left edge to flow left; otherwise flow left.
    const horizontal = align || ((r.left < room || r.left < vw * 0.4) ? 'left' : 'right');
    // Vertical: open downward when there isn't ~120px above the icon.
    const vertical = below != null ? (below ? 'below' : 'above') : (r.top < 120 ? 'below' : 'above');
    setPlace({ vertical, horizontal });
  };

  const vertical = place.vertical === 'below' ? 'top:calc(100% + 8px)' : 'bottom:calc(100% + 8px)';
  const horizontal = place.horizontal === 'left' ? 'left:0' : 'right:0';

  return (
    <span ref={ref} className="info-hint" tabIndex={0} role="note" aria-label={label}
      onMouseEnter={decide} onFocus={decide}
      style={s('position:relative;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;color:var(--d-muted);cursor:help;flex:none;outline:none')}>
      <Icon name="info" size={14} />
      <span className="info-hint__bubble"
        style={{ ...s(`position:absolute;${vertical};${horizontal};width:max-content;background:var(--d-ink);color:var(--d-card);font-size:12px;font-weight:600;line-height:1.45;padding:9px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.28);z-index:120;text-align:left;pointer-events:none`), maxWidth: `${maxWidth}px` }}>
        {text}
      </span>
    </span>
  );
}
