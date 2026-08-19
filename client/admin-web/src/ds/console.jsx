import { useEffect, useRef, useState } from 'react';
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

export function Panel({ children, hero, gradient, padded = true, style }) {
  // A plain panel lifts on --d-shadow-card (none by default, soft under the PWA
  // skin). `gradient` opts a hero panel into the brand gradient with white ink,
  // which is the PWA hero-card treatment; `hero` alone stays the pale teal fill.
  const bg = gradient ? 'var(--d-grad-primary)' : hero ? 'var(--d-primary-soft)' : 'var(--d-card)';
  // Plain cards carry the hairline so they keep an edge in dark mode where the
  // shadow does nothing; hero/gradient panels have their own fill and don't need it.
  const border = gradient || hero ? undefined : '1px solid var(--d-card-line, transparent)';
  return (
    <div style={{ ...s(`border-radius:24px;${padded ? 'padding:20px 22px;' : ''}display:flex;flex-direction:column`), background: bg, color: gradient ? 'var(--d-pill-ink)' : undefined, border, boxShadow: gradient ? 'var(--d-shadow-cta)' : hero ? undefined : 'var(--d-shadow-card)', ...style }}>
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
  // size accepts the named 'sm'/'md' or an explicit pixel number (larger avatars
  // on the detail pages). Radius and font scale with the box so big avatars read
  // right instead of a tiny label in a large square.
  const px = typeof size === 'number' ? size : size === 'sm' ? 32 : 40;
  const radius = Math.round(px * 0.28);
  const font = px >= 64 ? Math.round(px * 0.34) : px === 32 ? 11 : 13;
  if (src) return <img src={src} alt="" style={{ ...s('object-fit:cover;flex:none;display:block'), width: px, height: px, borderRadius: radius }} />;
  return <span style={{ ...s('background:var(--d-sage);display:inline-flex;align-items:center;justify-content:center;flex:none;font-weight:700;color:var(--d-ink2)'), width: px, height: px, borderRadius: radius, fontSize: font }}>{initials}</span>;
}

export function SeverityPill({ severity }) {
  const tone = severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'muted';
  const label = severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low';
  return <Tag tone={tone}>{label}</Tag>;
}

export function Button({ variant = 'ghost', icon, children, onClick, disabled, size = 'md' }) {
  const V = {
    // Primary paints --d-grad-primary (a flat colour on the current skin, the
    // brand gradient under the PWA skin) and carries --d-shadow-cta (none by
    // default). Hover still swaps to the flat --d-pill-hover via .hv.
    primary: { bg: 'var(--d-grad-primary)', ink: 'var(--d-pill-ink)', hbg: 'var(--d-pill-hover)', bd: 'transparent', shadow: 'var(--d-shadow-cta)' },
    ghost: { bg: 'var(--d-card)', ink: 'var(--d-ink)', hbg: 'var(--d-card-hover)', bd: 'var(--d-border)' },
    danger: { bg: 'var(--d-danger-bg)', ink: 'var(--d-danger-ink)', hbg: 'var(--d-danger-bg2)', bd: 'transparent' },
    subtle: { bg: 'var(--d-panel)', ink: 'var(--d-ink2)', hbg: 'var(--d-sage)', bd: 'transparent' },
  }[variant] || {};
  const h = size === 'sm' ? 34 : 40;
  return (
    <div onClick={disabled ? undefined : onClick} className="hv"
      style={{ ...s(`height:${h}px;border-radius:${h / 2}px;display:inline-flex;align-items:center;gap:7px;padding:0 ${size === 'sm' ? 13 : 16}px;font-size:${size === 'sm' ? 12.5 : 13.5}px;font-weight:700;cursor:pointer;box-sizing:border-box;white-space:nowrap`), background: V.bg, color: V.ink, border: `1px solid ${V.bd}`, boxShadow: V.shadow, '--hbg': V.hbg, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />} {children}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = 'primary', icon, live, active, onClick }) {
  const c = TONE[tone] || TONE.primary;
  return (
    <div onClick={onClick} className={onClick ? 'hv' : ''}
      style={{ ...s('border-radius:22px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box'), background: 'var(--d-card)', border: active ? '1.5px solid var(--d-primary)' : '1.5px solid var(--d-card-line, transparent)', boxShadow: active ? undefined : 'var(--d-shadow-card)', cursor: onClick ? 'pointer' : 'default', '--hbg': 'var(--d-card-hover)' }}>
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

// Segmented control — the one tab style across the console, matching the PWA.
// Used both for in-page filters and for a page's primary board view. (The old
// trapezium folder Tabs were a console-only metaphor the PWA has no equivalent
// for, so they were removed for a uniform look.)
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

// Prev/Next pager for admin list pages. Shows the current window and totals and
// hides itself when everything fits on one page. Works for server-side paging
// (pass page/total/perPage + onPage) or client-side (same props, slice locally).
export function Pager({ page, perPage, total, onPage }) {
  const pages = Math.max(1, Math.ceil((total ?? 0) / (perPage || 1)));
  if (pages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const btn = (dis) => ({
    ...s('height:36px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;padding:0 14px;font-size:12.5px;font-weight:700;cursor:pointer;border:1px solid var(--d-border);background:var(--d-card)'),
    color: dis ? 'var(--d-faint)' : 'var(--d-ink2)', opacity: dis ? 0.55 : 1, pointerEvents: dis ? 'none' : 'auto', fontFamily: 'inherit',
  });
  return (
    <div style={s('display:flex;align-items:center;gap:12px;justify-content:flex-end;padding:6px 2px')}>
      <span className="d-num" style={s('font-size:12px;font-weight:600;color:var(--d-muted)')}>{from}–{to} of {total}</span>
      <button type="button" style={btn(page <= 1)} onClick={() => onPage(page - 1)}><Icon name="chevronLeft" size={15} /> Prev</button>
      <span className="d-num" style={s('font-size:12px;font-weight:700;color:var(--d-ink2)')}>{page} / {pages}</span>
      <button type="button" style={btn(page >= pages)} onClick={() => onPage(page + 1)}>Next <Icon name="chevronRight" size={15} /></button>
    </div>
  );
}

/* ------------------------------ Filter controls ---------------------------- */
// One shared date/range/select set. Every page used to hand-roll these inline,
// which is why the Timesheets, Change log and Visit-audit filter bars all looked
// slightly different and some were invisible in light mode. Extracted here so a
// filter bar is identical everywhere and there is one place to get the styling
// right. Compose them inside <FilterBar>…</FilterBar>.

const FIELD_LABEL = 'font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em';
const FIELD_BOX = 'height:40px;border:1.5px solid var(--d-border);border-radius:12px;background:var(--d-card);color:var(--d-ink);font-size:12.5px;font-weight:600';

/* -------------------------------- Date picker ------------------------------ */
// A branded date field: shows UK DD/MM/YYYY, opens a popover calendar built from
// the console tokens (so it matches the PWA end to end, unlike the native input's
// OS popup), and honours min/max. The value contract is unchanged — it takes and
// returns an ISO 'YYYY-MM-DD' string, so every page and export keeps working.

const DP_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DP_DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const dpParse = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};
const dpIso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const dpUK = (iso) => { const d = dpParse(iso); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : ''; };
// Compare by calendar day, ignoring time.
const dpDayNum = (dt) => dt.getFullYear() * 10000 + dt.getMonth() * 100 + dt.getDate();

export function DatePicker({ value, onChange, min, max, width = 160 }) {
  const [open, setOpen] = useState(false);
  // The month the calendar is showing; seeded from the value (or today).
  const [view, setView] = useState(() => dpParse(value) || new Date());
  const wrapRef = useRef(null);

  useEffect(() => { if (open) setView(dpParse(value) || new Date()); }, [open, value]);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = dpParse(value);
  const minN = min ? dpDayNum(dpParse(min)) : -Infinity;
  const maxN = max ? dpDayNum(dpParse(max)) : Infinity;
  const disabledDay = (dt) => { const n = dpDayNum(dt); return n < minN || n > maxN; };

  // Build the 6-week grid for the viewed month, Monday-first.
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const todayN = dpDayNum(new Date());

  const step = (delta) => setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
  const pick = (dt) => { if (!disabledDay(dt)) { onChange(dpIso(dt)); setOpen(false); } };

  return (
    <div ref={wrapRef} style={s('position:relative;flex:none')}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ ...s(`${FIELD_BOX};display:flex;align-items:center;gap:9px;padding:0 13px;cursor:pointer;text-align:left`), width, fontFamily: 'inherit' }}>
        <span style={{ ...s('flex:1;min-width:0'), color: value ? 'var(--d-ink)' : 'var(--d-faint)' }}>{value ? dpUK(value) : 'dd/mm/yyyy'}</span>
        <Icon name="calendar" size={16} />
      </button>
      {open && (
        <div style={{ ...s('position:absolute;z-index:60;top:calc(100% + 6px);left:0;border-radius:16px;padding:12px;width:248px'), background: 'var(--d-card)', border: '1px solid var(--d-border)', boxShadow: 'var(--d-shadow-lg, 0 12px 28px rgba(0,0,0,0.18))' }}>
          <div style={s('display:flex;align-items:center;justify-content:space-between;margin-bottom:10px')}>
            <button type="button" onClick={() => step(-1)} className="hv" style={{ ...s('width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--d-border);background:var(--d-card);color:var(--d-ink2)'), '--hbg': 'var(--d-card-hover)' }}><Icon name="chevronLeft" size={16} /></button>
            <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{DP_MONTHS[view.getMonth()]} {view.getFullYear()}</div>
            <button type="button" onClick={() => step(1)} className="hv" style={{ ...s('width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--d-border);background:var(--d-card);color:var(--d-ink2)'), '--hbg': 'var(--d-card-hover)' }}><Icon name="chevronRight" size={16} /></button>
          </div>
          <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px')}>
            {DP_DOW.map((d) => <div key={d} style={s('height:24px;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;color:var(--d-muted);text-transform:uppercase')}>{d}</div>)}
          </div>
          <div style={s('display:grid;grid-template-columns:repeat(7,1fr);gap:2px')}>
            {days.map((dt) => {
              const inMonth = dt.getMonth() === view.getMonth();
              const n = dpDayNum(dt);
              const isSel = selected && n === dpDayNum(selected);
              const isToday = n === todayN;
              const dis = disabledDay(dt);
              return (
                <button key={n} type="button" disabled={dis} onClick={() => pick(dt)} className={isSel || dis ? '' : 'hv'}
                  style={{ ...s('height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;cursor:pointer;border:1px solid transparent'),
                    background: isSel ? 'var(--d-pill)' : 'transparent',
                    color: isSel ? 'var(--d-pill-ink)' : dis ? 'var(--d-faint)' : inMonth ? 'var(--d-ink)' : 'var(--d-faint)',
                    borderColor: isToday && !isSel ? 'var(--d-border-strong, var(--d-border))' : 'transparent',
                    opacity: dis ? 0.4 : 1, cursor: dis ? 'not-allowed' : 'pointer', '--hbg': 'var(--d-card-hover)' }}>
                  {dt.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function DateField({ label, value, onChange, max, min }) {
  return (
    <div style={s('display:flex;flex-direction:column;gap:5px;flex:none')}>
      {label && <span style={s(FIELD_LABEL)}>{label}</span>}
      <DatePicker value={value} onChange={onChange} min={min} max={max} />
    </div>
  );
}

// Branded select: a token-styled trigger + a popover options list, replacing the
// native <select> whose open menu is the OS's (unthemed white in dark mode, off
// brand). Same API as before — options are {id|value, label}; pass allLabel to
// prepend an "all/any" row (omit it for a required choice like a setting).
export function SelectField({ label, value, onChange, options, allLabel, minWidth = 160, disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const optVal = (o) => (o.id !== undefined ? o.id : o.value);
  const items = allLabel != null ? [{ __all: true, label: allLabel }, ...options] : options;
  const current = options.find((o) => optVal(o) === value);
  const shown = current ? current.label : (allLabel ?? 'Select…');

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const choose = (o) => { onChange(o.__all ? '' : optVal(o)); setOpen(false); };

  return (
    <div style={{ ...s('display:flex;flex-direction:column;gap:5px;flex:none'), width: minWidth }}>
      {label && <span style={s(FIELD_LABEL)}>{label}</span>}
      <div ref={wrapRef} style={s('position:relative')}>
        <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
          style={{ ...s(`${FIELD_BOX};display:flex;align-items:center;gap:8px;padding:0 11px;cursor:pointer;text-align:left;width:100%`), fontFamily: 'inherit', opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <span style={s('flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{shown}</span>
          <span style={{ display: 'inline-flex', transition: 'transform 0.15s ease', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--d-muted)' }}><Icon name="chevronDown" size={16} /></span>
        </button>
        {open && !disabled && (
          <div style={{ ...s('position:absolute;z-index:60;top:calc(100% + 6px);left:0;width:100%;min-width:180px;border-radius:12px;padding:5px;max-height:280px;overflow-y:auto'), background: 'var(--d-card)', border: '1px solid var(--d-border)', boxShadow: 'var(--d-shadow-lg, 0 12px 28px rgba(0,0,0,0.18))' }}>
            {items.map((o) => {
              const v = o.__all ? '' : optVal(o);
              const sel = v === value;
              return (
                <button key={o.__all ? '__all' : v} type="button" onClick={() => choose(o)} className={sel ? '' : 'hv'}
                  style={{ ...s('display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;border-radius:9px;padding:9px 10px;font-size:12.5px;font-weight:600;cursor:pointer'), fontFamily: 'inherit', background: sel ? 'var(--d-pill)' : 'transparent', color: sel ? 'var(--d-pill-ink)' : 'var(--d-ink2)', '--hbg': 'var(--d-card-hover)' }}>
                  <span style={s('flex:1;min-width:0')}>{o.label}</span>
                  {sel && <Icon name="check" size={14} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Quick-range chips (7d / 30d / 90d by default). `active` is the currently
// selected day-count, so the chosen chip reads as selected; onSelect(days) fires.
export function RangeChips({ ranges = [{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }], active, onSelect }) {
  return (
    <div style={s('display:flex;gap:6px;align-items:center;height:40px')}>
      {ranges.map((r) => {
        const on = active === r.days;
        return (
          <button key={r.label} type="button" onClick={() => onSelect(r.days)} className={on ? '' : 'hv'}
            style={{ ...s('height:32px;padding:0 12px;border-radius:16px;font-size:11.5px;font-weight:700;cursor:pointer'), fontFamily: 'inherit', background: on ? 'var(--d-pill)' : 'var(--d-card)', color: on ? 'var(--d-pill-ink)' : 'var(--d-ink2)', border: `1px solid ${on ? 'transparent' : 'var(--d-border)'}`, '--hbg': 'var(--d-card-hover)' }}>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

// Row wrapper: aligns fields on their bottom edge, wraps on narrow screens, and
// pushes anything after a <FilterBar.Spacer/> (e.g. export buttons) to the right.
// NOTE: style is MERGED into the flex base, never spread over it — passing
// style={{marginTop}} used to clobber display:flex and stack every field.
export function FilterBar({ children, style, ...rest }) {
  return <div style={{ ...s('display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap'), ...style }} {...rest}>{children}</div>;
}
FilterBar.Spacer = function Spacer() { return <div style={s('flex:1')} />; };

/* ------------------------------- Form fields ------------------------------- */
// The console's one text-field look, replacing the per-page inline styles that
// each declared their own `background:var(--d-field);border:transparent`. That
// convention went invisible on the PWA skin's brighter surfaces, so the field
// now has a real border against the card. Two ways to use it:
//   • <Input/> / <Select/> / <Textarea/> / <SearchBox/> for straight cases;
//   • fieldStyle({...}) when a page needs to spread the style into its own markup
//     (custom width, inside a grid), so every field still shares one definition.
//
// size 'md' (default) is the form size; 'sm' the compact filter/inline size.
export function fieldStyle({ size = 'md', error = false, disabled = false, area = false } = {}) {
  const h = size === 'sm' ? 40 : 46;
  const r = size === 'sm' ? 12 : 14;
  return {
    ...s(`${area ? '' : `height:${h}px;`}border-radius:${r}px;background:var(--d-field);color:var(--d-ink);font-size:${size === 'sm' ? 12.5 : 14}px;font-weight:600;padding:${area ? '11px 14px' : `0 14px`};outline:none;box-sizing:border-box;width:100%${area ? ';resize:vertical;line-height:1.5' : ''}`),
    border: `1.5px solid ${error ? 'var(--d-danger-ink)' : 'var(--d-border)'}`,
    fontFamily: 'inherit',
    opacity: disabled ? 0.55 : 1,
  };
}

export function Input({ size, error, disabled, style, ...rest }) {
  return <input disabled={disabled} style={{ ...fieldStyle({ size, error, disabled }), ...style }} {...rest} />;
}

export function Textarea({ size, error, disabled, style, rows = 3, ...rest }) {
  return <textarea rows={rows} disabled={disabled} style={{ ...fieldStyle({ size, error, disabled, area: true }), ...style }} {...rest} />;
}

// Native select carrying the same box. Pass either children <option>s or an
// `options` array of {value,label} (a leading `placeholder` becomes value="").
export function Select({ size, error, disabled, style, options, placeholder, children, ...rest }) {
  return (
    <select disabled={disabled} style={{ ...fieldStyle({ size, error, disabled }), cursor: disabled ? 'not-allowed' : 'pointer', ...style }} {...rest}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
    </select>
  );
}

// Search box: a magnifier + borderless input inside the shared field box. The
// pill radius is what tells it apart from a plain text field at a glance.
export function SearchBox({ value, onChange, placeholder = 'Search…', pill = true, style }) {
  return (
    <div style={{ ...fieldStyle({}), display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderRadius: pill ? 999 : 14, ...style }}>
      <Icon name="search" size={17} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...s('flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:13.5px;font-weight:500;color:var(--d-ink)'), fontFamily: 'inherit' }} />
    </div>
  );
}
