import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';

// Shared console primitives, ported from the design's component set into the
// token system: panels, stat cards, tags, tables and hand-built SVG charts.

const TONE = {
  success: { bg: 'var(--d-ok-bg)', ink: 'var(--d-ok-ink)' },
  warning: { bg: 'var(--d-warn-bg)', ink: 'var(--d-warn-ink)' },
  danger: { bg: 'var(--d-danger-bg)', ink: 'var(--d-danger-ink)' },
  info: { bg: 'var(--d-info-bg)', ink: 'var(--d-info-ink)' },
  primary: { bg: 'var(--d-primary-soft)', ink: 'var(--d-primary-deep)' },
  magenta: { bg: 'var(--d-primary-soft)', ink: 'var(--d-magenta)' },
  muted: { bg: 'var(--d-panel)', ink: 'var(--d-muted)' },
};

export function Panel({ children, hero, padded = true, style }) {
  return (
    <div style={{ ...s(`border-radius:24px;${padded ? 'padding:20px 22px;' : ''}display:flex;flex-direction:column`), background: hero ? 'var(--d-primary-soft)' : 'var(--d-card)', ...style }}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, hint, action }) {
  return (
    <div style={s('display:flex;align-items:flex-start;gap:12px;margin-bottom:16px')}>
      <div style={s('flex:1;min-width:0')}>
        <div style={s('font-size:15px;font-weight:700;color:var(--d-ink);letter-spacing:-0.2px')}>{children}</div>
        {hint && <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);margin-top:3px;line-height:1.45')}>{hint}</div>}
      </div>
      {action}
    </div>
  );
}

export function Tag({ tone = 'muted', children }) {
  const c = TONE[tone] || TONE.muted;
  return <span style={{ ...s('height:22px;border-radius:11px;display:inline-flex;align-items:center;gap:4px;padding:0 9px;font-size:11px;font-weight:700;white-space:nowrap'), background: c.bg, color: c.ink }}>{children}</span>;
}

export function Avatar({ initials, size = 'md', src }) {
  const px = size === 'sm' ? 32 : 40;
  if (src) return <img src={src} alt="" style={{ ...s('border-radius:12px;object-fit:cover;flex:none;display:block'), width: px, height: px }} />;
  return <span style={{ ...s('border-radius:12px;background:var(--d-sage);display:inline-flex;align-items:center;justify-content:center;flex:none;font-weight:700;color:var(--d-ink2)'), width: px, height: px, fontSize: size === 'sm' ? 11 : 13 }}>{initials}</span>;
}

export function SeverityPill({ severity }) {
  const tone = severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'muted';
  const label = severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low';
  return <Tag tone={tone}>{label}</Tag>;
}

export function Button({ variant = 'ghost', icon, children, onClick, disabled, size = 'md' }) {
  const V = {
    primary: { bg: 'var(--d-pill)', ink: 'var(--d-pill-ink)', hbg: 'var(--d-pill-hover)', bd: 'transparent' },
    ghost: { bg: 'var(--d-card)', ink: 'var(--d-ink)', hbg: 'var(--d-card-hover)', bd: 'var(--d-border)' },
    danger: { bg: 'var(--d-danger-bg)', ink: 'var(--d-danger-ink)', hbg: 'var(--d-danger-bg2)', bd: 'transparent' },
    subtle: { bg: 'var(--d-panel)', ink: 'var(--d-ink2)', hbg: 'var(--d-sage)', bd: 'transparent' },
  }[variant] || {};
  const h = size === 'sm' ? 34 : 40;
  return (
    <div onClick={disabled ? undefined : onClick} className="hv"
      style={{ ...s(`height:${h}px;border-radius:${h / 2}px;display:inline-flex;align-items:center;gap:7px;padding:0 ${size === 'sm' ? 13 : 16}px;font-size:${size === 'sm' ? 12.5 : 13.5}px;font-weight:700;cursor:pointer;box-sizing:border-box;white-space:nowrap`), background: V.bg, color: V.ink, border: `1px solid ${V.bd}`, '--hbg': V.hbg, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />} {children}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'primary', icon, live, active, onClick }) {
  const c = TONE[tone] || TONE.primary;
  return (
    <div onClick={onClick} className={onClick ? 'hv' : ''}
      style={{ ...s('border-radius:22px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box'), background: 'var(--d-card)', border: active ? '1.5px solid var(--d-primary)' : '1.5px solid transparent', cursor: onClick ? 'pointer' : 'default', '--hbg': 'var(--d-card-hover)' }}>
      <div style={s('display:flex;align-items:center;gap:10px')}>
        <div style={{ ...s('width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none'), background: c.bg, color: c.ink }}>
          <Icon name={icon} size={18} />
        </div>
        {live && <span style={s('display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--d-ok-ink);text-transform:uppercase;letter-spacing:0.05em;margin-left:auto')}><span style={s('width:7px;height:7px;border-radius:50%;background:var(--d-ok-ink)')} />Live</span>}
      </div>
      <div className="d-num" style={s('font-size:32px;font-weight:700;color:var(--d-ink);line-height:1')}>{value}</div>
      <div style={s('display:flex;flex-direction:column;gap:2px')}>
        <div style={s('font-size:13px;font-weight:600;color:var(--d-ink)')}>{label}</div>
        {hint && <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{hint}</div>}
      </div>
    </div>
  );
}

// Normal tabs — a compact segmented control for in-page filters. (The folder
// Tabs in ds/Tabs.jsx are reserved for a page's primary board view.)
export function SegTabs({ tabs, active, onSelect }) {
  return (
    <div style={s('display:inline-flex;align-items:center;gap:3px;background:var(--d-card);border-radius:15px;padding:4px;flex-wrap:wrap;max-width:100%')}>
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <div key={t.key} onClick={() => onSelect(t.key)} className={on ? '' : 'hv'}
            style={{ ...s('height:32px;border-radius:11px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;cursor:pointer;font-size:12.5px;font-weight:700;white-space:nowrap'), background: on ? 'var(--d-pill)' : 'transparent', color: on ? 'var(--d-pill-ink)' : 'var(--d-ink2)', '--hbg': 'var(--d-panel)' }}>
            {t.icon && <Icon name={t.icon} size={14} />}
            {t.label}
            {t.count != null && <span style={{ ...s('min-width:18px;height:18px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;padding:0 5px'), background: on ? 'rgba(255,255,255,0.22)' : 'var(--d-panel)', color: on ? 'var(--d-pill-ink)' : 'var(--d-muted)' }}>{t.count}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- Table ---------------------------------- */

export function TableWrap({ children, minWidth = 760 }) {
  return (
    <div style={s('overflow-x:auto')}>
      <table style={{ ...s('width:100%;border-collapse:collapse'), minWidth }}>{children}</table>
    </div>
  );
}
export function Th({ children, align }) {
  return <th style={{ ...s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em;padding:8px 12px'), textAlign: align || 'left' }}>{children}</th>;
}
export function Td({ children, align, mono }) {
  return <td style={{ ...s('font-size:12.5px;font-weight:500;color:var(--d-ink2);padding:12px;border-top:1px solid var(--d-border)'), textAlign: align || 'left', fontVariantNumeric: mono ? 'tabular-nums' : undefined }}>{children}</td>;
}
export function Row({ children, onClick, selected }) {
  return <tr onClick={onClick} className={onClick ? 'hv' : ''} style={{ cursor: onClick ? 'pointer' : 'default', background: selected ? 'var(--d-panel)' : 'transparent', '--hbg': 'var(--d-panel)' }}>{children}</tr>;
}

/* --------------------------------- Charts --------------------------------- */

export function BarChart({ data, unit = '' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={s('display:flex;align-items:flex-end;gap:10px;height:170px;padding-top:10px')}>
      {data.map((d) => (
        <div key={d.label} style={s('flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end')}>
          <div className="d-num" style={s('font-size:11px;font-weight:700;color:var(--d-ink2)')}>{d.value}{unit}</div>
          <div style={{ ...s('width:100%;max-width:34px;border-radius:8px 8px 3px 3px'), height: `${(d.value / max) * 100}%`, minHeight: 4, background: d.color || 'var(--d-primary)' }} />
          <div style={s('font-size:10.5px;font-weight:600;color:var(--d-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%')}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StackedBars({ data }) {
  const totals = data.map((d) => d.segments.reduce((a, x) => a + x.value, 0));
  const max = Math.max(...totals, 1);
  return (
    <div style={s('display:flex;align-items:flex-end;gap:10px;height:170px;padding-top:10px')}>
      {data.map((d, i) => (
        <div key={d.label} style={s('flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end')}>
          <div style={{ ...s('width:100%;max-width:30px;border-radius:8px 8px 3px 3px;overflow:hidden;display:flex;flex-direction:column-reverse'), height: `${(totals[i] / max) * 100}%`, minHeight: 6 }}>
            {d.segments.map((x, j) => (
              <div key={j} style={{ height: `${(x.value / (totals[i] || 1)) * 100}%`, background: x.color }} />
            ))}
          </div>
          <div style={s('font-size:10.5px;font-weight:600;color:var(--d-muted)')}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ series, height = 190 }) {
  const w = 560; const h = height; const pad = 14;
  const max = Math.max(...series.map((d) => d.value), 1);
  const min = Math.min(...series.map((d) => d.value), 0);
  const span = max - min || 1;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(series.length - 1, 1);
  const y = (v) => pad + (h - pad * 2) * (1 - (v - min) / span);
  const pts = series.map((d, i) => `${x(i)},${y(d.value)}`);
  const area = `M ${x(0)},${h - pad} L ${pts.join(' L ')} L ${x(series.length - 1)},${h - pad} Z`;
  return (
    <div style={s('width:100%')}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--d-primary)', stopOpacity: 0.28 }} />
            <stop offset="1" style={{ stopColor: 'var(--d-primary)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lc)" />
        <polyline points={pts.join(' ')} fill="none" style={{ stroke: 'var(--d-primary)' }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r="3" style={{ fill: 'var(--d-primary)' }} />)}
      </svg>
      <div style={s('display:flex;justify-content:space-between;margin-top:6px')}>
        {series.map((d) => <div key={d.label} style={s('font-size:10.5px;font-weight:600;color:var(--d-muted)')}>{d.label}</div>)}
      </div>
    </div>
  );
}

export function DonutChart({ segments, total }) {
  const R = 62; const C = 2 * Math.PI * R; const sum = total ?? segments.reduce((a, x) => a + x.value, 0);
  let acc = 0;
  return (
    <div style={s('display:flex;align-items:center;gap:20px;flex-wrap:wrap')}>
      <div style={s('position:relative;width:160px;height:160px;flex:none')}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={R} fill="none" style={{ stroke: 'var(--d-track)' }} strokeWidth="16" />
          {segments.map((seg, i) => {
            const frac = seg.value / (sum || 1);
            const dash = `${C * frac} ${C}`;
            const off = -acc * C;
            acc += frac;
            return <circle key={i} cx="80" cy="80" r={R} fill="none" style={{ stroke: seg.color }} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={off} transform="rotate(-90 80 80)" strokeLinecap="butt" />;
          })}
        </svg>
        <div style={s('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center')}>
          <div className="d-num" style={s('font-size:26px;font-weight:700;color:var(--d-ink)')}>{sum}</div>
          <div style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>total</div>
        </div>
      </div>
      <div style={s('display:flex;flex-direction:column;gap:8px')}>
        {segments.map((seg) => (
          <div key={seg.label} style={s('display:flex;align-items:center;gap:8px')}>
            <span style={{ ...s('width:10px;height:10px;border-radius:3px'), background: seg.color }} />
            <span style={s('font-size:12.5px;font-weight:600;color:var(--d-ink2)')}>{seg.label}</span>
            <span className="d-num" style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);margin-left:auto')}>{Math.round((seg.value / (sum || 1)) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CHART = {
  primary: 'var(--d-primary)', lime: 'var(--d-lime)', magenta: 'var(--d-magenta)',
  ok: 'var(--d-ok-ink)', warn: 'var(--d-warn-dot)', danger: 'var(--d-danger-dot)', track: 'var(--d-track)',
};
