import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { s } from '../lib/ui.jsx';
import Icon from '../components/common/Icon.jsx';

// Ported verbatim from the design (OffersReview.jsx): the trapezium tab whose
// active outer corner grows to the panel radius so it reads as the panel's
// rounded "ear" and merges into it. Generalised to take a `tabs` array.
const SLANT = 34;
const TOPR = 14;

// botR rounds the two bottom corners with quadratic curves. Left 0 (the default)
// keeps the bottom flush so the active tab merges into the panel below; a
// positive value gives a standalone, fully-rounded tab.
function tabShape(W, H, edge, outerR, botR = 0) {
  const S = SLANT;
  const R = TOPR;
  const O = outerR || TOPR;
  const B = botR;
  const p = [];
  if (edge === 'first') p.push('M 0 ' + (H - B), 'L 0 ' + O, 'Q 0 0 ' + O + ' 0');
  else p.push('M 0 ' + (H - B), 'L ' + (S - R * 0.5) + ' ' + R, 'Q ' + S + ' 0 ' + (S + R) + ' 0');
  if (edge === 'last') p.push('L ' + (W - O) + ' 0', 'Q ' + W + ' 0 ' + W + ' ' + O, 'L ' + W + ' ' + (H - B));
  else p.push('L ' + (W - S - R) + ' 0', 'Q ' + (W - S) + ' 0 ' + (W - S + R * 0.5) + ' ' + R, 'L ' + W + ' ' + (H - B));
  // bottom edge — rounded corners when botR > 0, otherwise a straight line via Z
  if (B > 0) p.push('L ' + W + ' ' + (H - B), 'Q ' + W + ' ' + H + ' ' + (W - B) + ' ' + H, 'L ' + B + ' ' + H, 'Q 0 ' + H + ' 0 ' + (H - B));
  return { fillD: p.join(' ') + ' Z', vb: '0 0 ' + W + ' ' + H };
}

// The content panel under the tabs takes this radius so the corner next to the
// active tab is square and merges with it.
export function panelRadius(tabs, activeKey) {
  const i = tabs.findIndex((t) => t.key === activeKey);
  const first = i === 0;
  const last = i === tabs.length - 1;
  return `${first ? '0' : '32px'} ${last ? '0' : '32px'} 32px 32px`;
}

export default function Tabs({ tabs, active, onSelect, bottomRadius = 0 }) {
  const rowRef = useRef(null);
  const [tabW, setTabW] = useState([]);

  const measure = () => {
    const row = rowRef.current;
    if (!row) return;
    const ws = Array.prototype.map.call(row.children, (c) => c.offsetWidth);
    if (ws.length && (ws.length !== tabW.length || ws.some((w, i) => w !== tabW[i]))) setTabW(ws);
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rowRef} style={s('height:74px;flex:none;display:flex;align-items:flex-end;position:relative;z-index:1')}>
      {tabs.map((d, i) => {
        const on = active === d.key;
        const edge = i === 0 ? 'first' : i === tabs.length - 1 ? 'last' : null;
        const H = on ? 74 : 66;
        const inner = SLANT + 14;
        const sh = tabShape(tabW[i] || 300, H, edge, on ? 32 : TOPR, bottomRadius);
        const bub = on ? 'var(--d-primary)' : 'var(--d-card)';
        const bubInk = on ? 'var(--d-primary-ink)' : 'var(--d-muted)';
        const cntBg = d.alert && !on ? 'var(--d-danger-bg)' : on ? 'var(--d-primary)' : 'var(--d-field)';
        const cntInk = d.alert && !on ? 'var(--d-danger-ink)' : on ? '#FFFFFF' : 'var(--d-muted)';
        const bg = on ? 'var(--d-panel)' : 'var(--d-panel2)';
        return (
          <div
            key={d.key}
            onClick={() => onSelect(d.key)}
            style={{
              ...s('flex:1 1 0;min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:16px;cursor:pointer;position:relative'),
              height: H + 'px',
              zIndex: on ? 4 : 1,
              padding: '0 ' + (edge === 'last' ? 24 : inner) + 'px 0 ' + (edge === 'first' ? 24 : inner) + 'px',
              margin: '0 ' + (edge === 'last' ? 0 : -SLANT) + 'px 0 0',
            }}
          >
            <svg width="100%" height="100%" viewBox={sh.vb} preserveAspectRatio="none" style={s('position:absolute;left:0;top:0;pointer-events:none')}>
              <path d={sh.fillD} style={{ fill: bg }} />
            </svg>
            <div style={{ ...s('position:relative;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none'), background: bub, color: bubInk }}>
              <Icon name={d.icon} size={20} />
            </div>
            <div style={{ ...s('position:relative;font-size:16px;letter-spacing:-0.1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), fontWeight: on ? 700 : 500, color: on ? 'var(--d-ink)' : 'var(--d-muted)' }}>
              {d.label}
            </div>
            {d.count != null && (
              <div style={{ ...s('position:relative;min-width:34px;height:28px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;padding:0 8px;margin-left:auto;flex:none'), background: cntBg, color: cntInk }}>
                {d.count}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
