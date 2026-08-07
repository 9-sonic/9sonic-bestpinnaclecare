import { useLocation } from 'react-router-dom';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';

// Walkable placeholders for the sections in the new IA. Each says honestly where
// it stands: "wiring next" = the backend exists and this is next to build;
// "needs backend" = a new data model + usually a client-policy decision (routes
// through Ian and Jesse) before it can be real. No faked data.
const SECTIONS = {
  '/lifecycle': {
    icon: 'sync', phase: 'wiring next',
    blurb: 'Every visit as a state machine — scheduled, en route, on site, clocked in, completed, and the exception branches — derived from the live board.',
    points: ['State lanes with counts, from /admin/live_board', 'Click a visit to see its event history', 'Filter by state, carer or client'],
  },
  '/alerts': {
    icon: 'bell', phase: 'wiring next',
    blurb: 'The inbox of things the system raised: late, no clock out, unassigned, missed, out of range. Acknowledge or resolve, each logged.',
    points: ['Reads /admin/alerts', 'Acknowledge / resolve (already in the API)', 'Severity by proximity to the visit window'],
  },
  '/cover': {
    icon: 'refresh', phase: 'needs backend',
    blurb: 'The missing half of a call-off: a shift with no carer, offered out to eligible carers, with who accepted. Nothing routes this today.',
    points: ['New: open-shift + offer + acceptance model (Ian)', 'Client policy: who can be offered, auto vs manual (Jesse ↔ Best Pinnacle)', 'Advisory conflict checks, not blocking'],
  },
  '/requests': {
    icon: 'note', phase: 'needs backend',
    blurb: 'A carer-initiated queue: shift swaps, drops, overtime opt-ins, availability changes, and leave. Approve or decline, with the rota kept honest.',
    points: ['New: request + absence/leave model (Ian)', 'Leave policy and entitlements (Jesse ↔ Best Pinnacle)', 'Rota warns when assigning someone who is off'],
  },
  '/messages': {
    icon: 'chat', phase: 'partly wired',
    blurb: 'The manager side of the carer chat. Direct threads exist in the API; channels, groups and broadcast-with-acknowledgement are new.',
    points: ['DMs read /conversations + /messages + receipts', 'New: channels, groups, broadcast + ack tally', 'Message-carer action from any shift or exception'],
  },
  '/audit': {
    icon: 'file', phase: 'needs backend',
    blurb: 'The append-only history: corrections, approvals, assignments, setting changes — who did what, when, and why. Corrections already append; this is the read view.',
    points: ['New: /admin/audit read endpoint (Ian)', 'Filter by actor, entity and date', 'Every clock correction and lock lands here'],
  },
  '/reports': {
    icon: 'trend', phase: 'needs backend',
    blurb: 'Attendance and punctuality over a period, hours by team, exception volume, late-arrival hotspots. Charts stay hand-built SVG.',
    points: ['New: aggregation endpoints (Ian)', 'Which metrics matter is a product call (Jesse)', 'Export a report pack'],
  },
};

const PHASE_TONE = {
  'wiring next': { bg: 'var(--d-info-bg)', ink: 'var(--d-info-ink)' },
  'partly wired': { bg: 'var(--d-ok-bg)', ink: 'var(--d-ok-ink)' },
  'needs backend': { bg: 'var(--d-warn-bg)', ink: 'var(--d-warn-ink)' },
};

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const cfg = SECTIONS[pathname] ?? { icon: 'help', phase: 'wiring next', blurb: 'This section is part of the new manager console.', points: [] };
  const tone = PHASE_TONE[cfg.phase] ?? PHASE_TONE['wiring next'];

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px;max-width:760px')}>
      <div style={s('background:var(--d-card);border-radius:28px;padding:34px 32px;display:flex;flex-direction:column;gap:18px')}>
        <div style={s('display:flex;align-items:center;gap:16px')}>
          <div style={s('width:60px;height:60px;border-radius:20px;background:var(--d-primary-soft);display:flex;align-items:center;justify-content:center;flex:none;color:var(--d-primary-deep)')}>
            <Icon name={cfg.icon} size={28} />
          </div>
          <div style={{ ...s('height:28px;border-radius:14px;display:inline-flex;align-items:center;padding:0 13px;font-size:12px;font-weight:700;text-transform:capitalize'), background: tone.bg, color: tone.ink }}>
            {cfg.phase}
          </div>
        </div>
        <div style={s('font-size:15px;font-weight:500;color:var(--d-ink2);line-height:1.6')}>{cfg.blurb}</div>
        {cfg.points.length > 0 && (
          <div style={s('display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--d-border);padding-top:18px')}>
            {cfg.points.map((p) => (
              <div key={p} style={s('display:flex;align-items:flex-start;gap:11px')}>
                <div style={s('width:20px;height:20px;border-radius:7px;background:var(--d-sage);display:flex;align-items:center;justify-content:center;flex:none;color:var(--d-primary);margin-top:1px')}><Icon name="check" size={13} /></div>
                <div style={s('font-size:13.5px;font-weight:500;color:var(--d-ink2);line-height:1.5')}>{p}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);padding:0 4px;line-height:1.5')}>
        Design preview from the new IA. Building these is scoped as separate BES tickets so the work stays visible; the ones marked <b style={s('font-weight:700;color:var(--d-ink2)')}>needs backend</b> also need Ian&apos;s data model and a client-policy decision through Jesse before they go live.
      </div>
    </div>
  );
}
