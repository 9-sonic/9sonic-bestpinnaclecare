import { useEffect, useState } from 'react';
import { getSettings, listAlerts } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { Panel, PanelTitle, Tag, TableWrap, Th, Td, Row } from '../ds/console.jsx';
import { LIFECYCLE_LABELS, LIFECYCLE_TONE, formatTime, formatDate } from '../api/format.js';

// Happy path + exception branches, using OUR real lifecycle_state enum.
const HAPPY = ['scheduled', 'check_in_window', 'grace_period', 'in_progress', 'completed'];
const BRANCH = ['late', 'overdue', 'pending_review', 'missed'];
const DESC = {
  scheduled: 'On the rota, not yet due to start.',
  check_in_window: 'Start time reached, within the grace period.',
  grace_period: 'Grace period running before a visit is marked late.',
  in_progress: 'Carer clocked in and currently delivering care.',
  completed: 'Shift finished, verified and released to payroll.',
  late: 'Clock in landed after the grace period.',
  overdue: 'Past the scheduled end with no clock out.',
  pending_review: 'Sitting with a manager in the exceptions queue.',
  missed: 'No clock in recorded — escalation pathway triggered.',
};
const DOT = { neutral: 'var(--d-faint)', info: 'var(--d-info-ink)', warn: 'var(--d-warn-dot)', active: 'var(--d-info-ink)', danger: 'var(--d-danger-dot)', success: 'var(--d-ok-ink)' };
const L2TAG = { neutral: 'muted', info: 'info', warn: 'warning', active: 'info', danger: 'danger', success: 'success' };
const dot = (state) => DOT[LIFECYCLE_TONE[state]] ?? DOT.neutral;

export default function LifecyclePage() {
  const [settings, setSettings] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getSettings(), listAlerts().catch(() => [])])
      .then(([st, al]) => { if (active) { setSettings(st); setAlerts(al ?? []); } })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <Spinner fullscreen />;

  const grace = settings?.late_grace_minutes ?? 5;
  const autoClose = settings?.auto_close_after_minutes ?? 30;
  const radius = settings?.geofence_radius_m ?? 150;
  const mode = settings?.geofence_mode ?? 'block';

  const tiers = [
    { tier: 1, title: 'Carer reminder', delay: `+${grace} min after start`, audience: 'Assigned carer', channel: 'Push notification', description: 'A gentle nudge in the app: your shift has started, tap to clock in.', icon: 'bell' },
    { tier: 2, title: 'Coordinator alert', delay: '+15 min', audience: 'Team coordinator', channel: 'In-app + email', description: "The shift appears in the coordinator's exceptions queue for a phone check.", icon: 'alert' },
    { tier: 3, title: 'Manager SMS', delay: '+30 min', audience: 'Registered manager', channel: 'SMS', description: 'Urgent text to nominated managers — the visit is now at risk.', icon: 'phone' },
    { tier: 4, title: 'Cover reassignment', delay: '+45 min', audience: 'On-call carers', channel: 'SMS broadcast', description: 'Cover is offered to available carers so the client is never left without care.', icon: 'send' },
  ];

  const behaviours = [
    { t: 'Grace period', d: `Clock-ins within ${grace} minutes of the scheduled start are treated as on time.` },
    { t: 'Missed clock-out', d: `Open records are auto-flagged ${autoClose} minutes past the scheduled end and the carer is prompted.` },
    { t: 'Geofence check', d: `Clock points outside the ${radius}m radius are ${mode === 'block' ? 'refused' : mode === 'warn' ? 'flagged, never blocked' : 'recorded without checking'} — care always comes first.` },
    { t: 'Offline capture', d: 'No signal? Times are stored on the device with the original timestamps and synced later.' },
    { t: 'Break handling', d: 'Breaks pause paid time and are deducted automatically from timesheet totals.' },
    { t: 'Lone-worker check', d: 'Long visits without activity prompt a welfare check to the coordinator.' },
  ];

  const tierOf = (sev) => (sev === 'high' ? 3 : sev === 'medium' ? 2 : 1);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Shift states */}
      <Panel>
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
      </Panel>

      <div style={s('display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start')}>
        {/* Escalation pathway */}
        <Panel>
          <PanelTitle hint="Triggered automatically when a shift start passes without a clock in">Tiered escalation pathway</PanelTitle>
          <div style={s('display:flex;flex-direction:column;gap:12px;border-left:1px solid var(--d-border);padding-left:22px;position:relative')}>
            {tiers.map((t) => (
              <div key={t.tier} style={s('position:relative')}>
                <div style={s('position:absolute;top:12px;left:-33px;width:24px;height:24px;border-radius:50%;background:var(--d-primary);color:var(--d-primary-ink);display:flex;align-items:center;justify-content:center')}><Icon name={t.icon} size={13} /></div>
                <div style={s('border:1px solid var(--d-border);border-radius:14px;padding:14px 16px')}>
                  <div style={s('display:flex;align-items:center;gap:10px;flex-wrap:wrap')}>
                    <div style={s('font-size:14px;font-weight:700;color:var(--d-ink);flex:1;min-width:0')}>Tier {t.tier} · {t.title}</div>
                    <Tag tone={t.tier >= 3 ? 'danger' : 'primary'}>{t.delay}</Tag>
                  </div>
                  <div style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);margin-top:4px;line-height:1.5')}>{t.description}</div>
                  <div style={s('display:flex;gap:6px;flex-wrap:wrap;margin-top:9px')}>
                    <Tag tone="muted">{t.audience}</Tag>
                    <Tag tone="muted">{t.channel}</Tag>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={s('margin-top:14px;background:var(--d-panel);border-radius:14px;padding:13px 15px;font-size:11.5px;font-weight:500;color:var(--d-muted);line-height:1.55')}>Timings, recipients and channels are configurable per team in Settings. The defaults shown assume a {grace} minute grace period on shift start.</div>
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

      {/* Escalation log — real alerts */}
      <Panel padded={false} style={{ padding: '20px 22px' }}>
        <PanelTitle hint="Alerts the system raised — the escalation record">Escalation log</PanelTitle>
        {alerts.length === 0 ? (
          <div style={s('padding:28px 16px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>No escalations open right now.</div>
        ) : (
          <TableWrap minWidth={720}>
            <thead><tr><Th>Raised</Th><Th>Tier</Th><Th>Alert</Th><Th>Subject</Th><Th align="right">State</Th></tr></thead>
            <tbody>
              {alerts.map((al) => (
                <Row key={al.id}>
                  <Td mono>{formatDate(al.raised_at)} {formatTime(al.raised_at)}</Td>
                  <Td><Tag tone={al.severity === 'high' ? 'danger' : al.severity === 'medium' ? 'warning' : 'primary'}>Tier {tierOf(al.severity)}</Tag></Td>
                  <Td>{(al.alert_type ?? '').replace(/_/g, ' ')}</Td>
                  <Td>{al.subject_type} {al.subject_id}</Td>
                  <Td align="right"><Tag tone={al.state === 'resolved' ? 'success' : 'danger'}>{al.state ?? 'open'}</Tag></Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      {/* State detail cards */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px')}>
        {['in_progress', 'completed', 'late', 'pending_review'].map((st) => (
          <div key={st} style={s('background:var(--d-card);border-radius:18px;padding:16px 18px')}>
            <Tag tone={L2TAG[LIFECYCLE_TONE[st]] ?? 'muted'}>{LIFECYCLE_LABELS[st]}</Tag>
            <div style={s('font-size:12px;font-weight:500;color:var(--d-muted);line-height:1.5;margin-top:10px')}>{DESC[st]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
