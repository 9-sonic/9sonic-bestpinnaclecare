import { useEffect, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { getSettings } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import { Panel, PanelTitle, Tag } from '../ds/console.jsx';
import { LIFECYCLE_LABELS, LIFECYCLE_TONE } from '../api/format.js';

// The Guide — how clocking, escalation and the record work. This is reference
// material, not a live tool: it was scattered across the Lifecycle, Reports and
// Audit pages as explainer blocks; it now lives in one place. Grace and radius
// read from the real Setting so the numbers match what the system enforces.
const HAPPY = ['scheduled', 'check_in_window', 'grace_period', 'in_progress', 'completed'];
const BRANCH = ['late', 'overdue', 'pending_review', 'missed'];
const DESC = {
  scheduled: 'On the rota, not yet due to start.',
  check_in_window: 'Start time reached, within the grace period.',
  grace_period: 'Grace period running before a visit is marked late.',
  in_progress: 'Carer clocked in and currently delivering care.',
  completed: 'Shift finished and verified.',
  late: 'Clock in landed after the grace period.',
  overdue: 'Past the scheduled end with no clock out.',
  pending_review: 'Sitting with a manager in the exceptions queue.',
  missed: 'No clock in recorded — escalation pathway triggered.',
};
const DOT = { neutral: 'var(--d-faint)', info: 'var(--d-info-ink)', warn: 'var(--d-warn-dot)', active: 'var(--d-info-ink)', danger: 'var(--d-danger-dot)', success: 'var(--d-ok-ink)' };
const dot = (state) => DOT[LIFECYCLE_TONE[state]] ?? DOT.neutral;

const COMPLIANCE = [
  'Every entry is append-only. Records are written once and never altered or deleted — a correction adds a new row that points at what it supersedes.',
  'Amendments carry the author, the exact time, and a mandatory reason. The original clock event is always preserved.',
  'Location is captured only at clock moments, never between visits. UK-hosted; UK GDPR and NHS Data Security Standards apply.',
];

export default function GuidePage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSettings()
      .then((st) => { if (active) setSettings(st); })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <Spinner fullscreen />;

  // All numbers read from the live Settings, so the Guide always matches what
  // the system actually enforces — change a value in Settings and this updates.
  const grace = settings?.late_grace_minutes ?? 15;
  const autoClose = settings?.auto_close_after_minutes ?? 240;
  const overdue = settings?.overdue_threshold_minutes ?? 60;
  const radius = settings?.geofence_radius_m ?? 150;
  const geoMode = settings?.geofence_mode ?? 'block';
  const geoText = { block: `a tap outside the fence is refused`, warn: `a tap outside the fence warns the carer but is allowed`, record: `a tap outside the fence is recorded, not blocked` }[geoMode] ?? 'a tap outside the fence is refused';

  // What actually happens when a shift start passes with no clock-in — the real,
  // grace-based escalation, not a fixed timeline.
  const escalation = [
    { title: 'Within grace', when: `0–${grace} min after start`, icon: 'clock', tone: 'primary', description: `A clock-in inside the grace window counts as on time (or, just after the start, "late") — the visit simply goes ahead.` },
    { title: 'Grace expires → office alerted', when: `+${grace} min`, icon: 'alert', tone: 'danger', description: `Once the grace period passes with still no clock-in, the office is alerted straight away so it can call the carer or arrange cover — while there is still time to act.` },
    { title: 'Reconciled if it was offline', when: 'on sync', icon: 'sync', tone: 'primary', description: `If the carer clocked in offline (no signal), that tap syncs later and reconciles the visit from its real time — the alert clears itself. The carer was there; nothing is lost.` },
    { title: 'Genuinely missed', when: `+${settings?.missed_threshold_minutes ?? 30} min`, icon: 'close', tone: 'danger', description: `With no clock-in at all, the visit is a genuine no-show and stays flagged for the office to reassign and follow up.` },
  ];

  const behaviours = [
    { t: 'Grace period', d: `Clock-ins within ${grace} minutes of the scheduled start count as on time. After that, with no clock-in, the office is alerted.` },
    { t: 'Late arrival', d: `A carer who clocks in after the grace window is flagged for review — they should give a reason, and a manager can amend the record (append-only).` },
    { t: 'Offline reconciliation', d: `A clock-in taken offline keeps its original time. When it syncs it corrects the visit even if it had been flagged missed — the honest tap always wins.` },
    { t: 'Missed clock-out', d: `An open record is auto-closed to pending review ${autoClose} minutes past the scheduled end, and flagged overdue after ${overdue} minutes.` },
    { t: 'Geofence check', d: `Carers clock in at the client's address, within ${radius}m — ${geoText}.` },
    { t: 'Break handling', d: 'Breaks pause the worked-time clock and are deducted automatically from the recorded hours.' },
  ];

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Shift states */}
      <span data-tour="guide-states"><Panel>
        <PanelTitle hint="The happy path every completed visit follows">Shift states</PanelTitle>
        <div style={s('display:flex;flex-wrap:wrap;align-items:center;gap:8px')}>
          {HAPPY.map((st, i) => (
            <div key={st} style={s('display:flex;align-items:center;gap:8px')}>
              <div style={s('display:flex;align-items:center;gap:8px;border:1px solid var(--d-border);border-radius:12px;padding:9px 12px;background:var(--d-card)')}>
                <span style={{ ...s('width:8px;height:8px;border-radius:50%'), background: dot(st) }} />
                <span style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{LIFECYCLE_LABELS[st]}</span>
              </div>
              {i < HAPPY.length - 1 && <Icon name="chevronRight" size={15} />}
            </div>
          ))}
        </div>

        <div style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.06em;margin:18px 0 8px')}>Exception branches</div>
        <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
          {BRANCH.map((st) => (
            <div key={st} style={s('display:flex;align-items:center;gap:8px;border:1px dashed var(--d-border);border-radius:12px;padding:9px 12px')}>
              <span style={{ ...s('width:8px;height:8px;border-radius:50%'), background: dot(st) }} />
              <span style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{LIFECYCLE_LABELS[st]}</span>
              <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{DESC[st]}</span>
            </div>
          ))}
        </div>
      </Panel></span>

      <div style={s('display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start')}>
        {/* Escalation pathway */}
        <Panel>
          <PanelTitle hint="What happens when a shift start passes without a clock in">How a missed clock-in escalates</PanelTitle>
          <div style={s('display:flex;flex-direction:column;gap:12px;border-left:1px solid var(--d-border);padding-left:22px;position:relative')}>
            {escalation.map((t) => (
              <div key={t.title} style={s('position:relative')}>
                <div style={{ ...s('position:absolute;top:12px;left:-33px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center'), background: t.tone === 'danger' ? 'var(--d-danger-bg)' : 'var(--d-primary)', color: t.tone === 'danger' ? 'var(--d-danger-ink)' : 'var(--d-primary-ink)' }}><Icon name={t.icon} size={13} /></div>
                <div style={s('border:1px solid var(--d-border);border-radius:14px;padding:14px 16px')}>
                  <div style={s('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
                    <div style={s('font-size:14px;font-weight:700;color:var(--d-ink);flex:1;min-width:0')}>{t.title}</div>
                    <Tag tone={t.tone}>{t.when}</Tag>
                  </div>
                  <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);margin-top:4px;line-height:1.5')}>{t.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={s('margin-top:14px;background:var(--d-panel);border-radius:14px;padding:13px 15px;font-size:11.5px;font-weight:500;color:var(--d-muted);line-height:1.55')}>Every timing here comes from Settings — the grace period is {grace} minutes now. Change it in Settings and this pathway changes with it.</div>
        </Panel>

        {/* Automated behaviours */}
        <Panel>
          <PanelTitle hint="Rules the system applies without asking">Automated behaviours</PanelTitle>
          <div style={s('display:flex;flex-direction:column;gap:9px')}>
            {behaviours.map((r) => (
              <div key={r.t} style={s('border:1px solid var(--d-border);border-radius:14px;padding:12px 14px')}>
                <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{r.t}</div>
                <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px;line-height:1.5')}>{r.d}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* How the record is governed */}
      <Panel>
        <PanelTitle hint="How this data is governed">Record &amp; compliance</PanelTitle>
        <div style={s('display:flex;flex-direction:column;gap:10px')}>
          {COMPLIANCE.map((t) => (
            <div key={t} style={s('display:flex;gap:11px;align-items:flex-start')}>
              <div style={s('width:22px;height:22px;border-radius:7px;background:var(--d-ok-bg);display:flex;align-items:center;justify-content:center;flex:none;color:var(--d-ok-ink);margin-top:1px')}><Icon name="shield" size={13} /></div>
              <div style={s('font-size:13px;font-weight:500;color:var(--d-ink2);line-height:1.5')}>{t}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
