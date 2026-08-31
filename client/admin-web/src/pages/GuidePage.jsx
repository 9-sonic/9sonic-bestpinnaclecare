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

// Task-based walkthroughs — what an office user actually does, day to day, each
// paired with a screenshot of the real screen. Written so someone can follow it
// with no one from the delivery team on hand. `shot` is a file in public/guide.
const WALKTHROUGHS = [
  {
    id: 'live-board', icon: 'target', shot: '01-live-board.png',
    title: 'See who is on shift right now',
    intro: 'The Live board is your home screen — it answers "what needs me right now?" the moment you log in.',
    steps: [
      'The tiles across the top count who is on shift, who is late, what is missed or overdue, and what is completed today.',
      'The tabs (All shifts, Scheduled, On shift, Late, Missed, Completed) filter the list below to just those visits.',
      'Open alerts and Needs attention on the right surface the things to act on first — click through to Alerts or Exceptions to handle them.',
    ],
  },
  {
    id: 'exceptions', icon: 'alert', shot: '03-exceptions.png',
    title: 'Handle a missed or flagged visit',
    intro: 'The Exceptions queue is everything that needs a human decision — late arrivals, missed clock-ins, visits pending review.',
    steps: [
      'Each row explains what happened and when. Open it to see the clock record and the carer’s reason if they gave one.',
      'If the carer did attend but the tap was late or missed, record the real time — the visit reconciles and the original stays in the audit trail.',
      'Nothing here is deleted. Every correction is a new, signed, time-stamped entry with your reason.',
    ],
  },
  {
    id: 'staffing', icon: 'refresh', shot: '04-staffing.png',
    title: 'Arrange cover and handle requests',
    intro: 'Staffing is where you fill gaps and respond to carers — cover offers and carer requests in one place.',
    steps: [
      'Send an unfilled visit to the cover board; eligible carers are notified and can claim it from their phone.',
      'When a carer asks to drop a shift, approve or decline it here — they’re notified of your decision, with your note.',
      'Approving a drop frees the visit so you can reassign or send it for cover.',
    ],
  },
  {
    id: 'rota', icon: 'calendar', shot: '02-rota.png',
    title: 'Build and publish the week’s rota',
    intro: 'The Rota is the week grid. A visit sits in the column of the day it starts; an overnight one is marked with a "+1".',
    steps: [
      'Click a visit block to open it — an unfilled visit opens the assign panel, a filled one its details.',
      'The circle on each block opens its actions: assign or reassign a carer, find cover, cancel, or select it for a bulk action.',
      'Generate next week creates the recurring visits from each client’s care package; Publish rota makes the draft visits live to carers.',
      'When you publish, each assigned carer is notified on their phone — they don’t have to open the app to learn they’re on.',
    ],
  },
  {
    id: 'add-visit', icon: 'plus', shot: '12-add-visit-modal.png',
    title: 'Add a one-off visit to the rota',
    intro: 'Use Add visit on the Rota for a single extra visit. It starts as a draft until you publish.',
    steps: [
      'On the Rota, switch between By carer and By client with the tabs — the Add visit form matches whichever you are looking at.',
      'Click Add visit, choose the client (and carer, on the carer tab), the day, and the start and end time.',
      'The panel shows the exact start and end date it will save. For an overnight visit (e.g. 23:30–01:00) the end rolls to the next day and is marked "overnight".',
      'Click Create visit. It appears on the rota as a draft — publish the rota to make it visible to the carer.',
    ],
  },
  {
    id: 'attendance', icon: 'wallet', shot: '05-attendance.png',
    title: 'Check and correct attendance records',
    intro: 'Attendance records is the CQC visit-attendance view — one row per carer × visit, read straight from verified clock records.',
    steps: [
      'Filter by date range, client, or carer. Late arrivals and off-site distances are shown per clock, in metres.',
      'Use Amend on a row to correct a clock time — it writes an audited correction (who, when, why); the original is never overwritten.',
      'Export the filtered range as CSV or Excel from the Export button.',
    ],
  },
  {
    id: 'care-notes', icon: 'note', shot: '06-care-notes.png',
    title: 'Find and export care notes',
    intro: 'Care notes is the office-wide journal of what carers wrote on their visits — filterable by carer and client together.',
    steps: [
      'Set the date range, and narrow by client, carer, or a text search of the note body.',
      'Every note shows who wrote it, for which client, and on which visit date.',
      'Export the filtered notes as a PDF or Word document to print or file — it is exactly the set on screen.',
    ],
  },
  {
    id: 'client-detail', icon: 'user', shot: '14-client-detail.png',
    title: 'Open a client’s record',
    intro: 'From Clients, click Open on anyone to see their full record — their details, address and geofence, care schedule, visits and notes.',
    steps: [
      'The header shows the client’s address and the geofence that governs every clock-in at their home (the radius, and whether an off-site tap is blocked or just recorded).',
      'The tabs move between their care schedule, the visits that have happened (who attended, when), and the care notes written about them.',
      'Everything here is read from real records — it’s the single place to answer "what care has this person had, and by whom".',
    ],
  },
  {
    id: 'carer-detail', icon: 'users', shot: '15-carer-detail.png',
    title: 'Open a carer’s record — visits, requests, cover',
    intro: 'From Employees, click View on a carer for their whole picture: hours this week, punctuality, contracted hours, and tabs for everything they’ve done.',
    steps: [
      'Visits — every visit they attended, with the actual clock-in/out times, minutes worked, and status. This is where you check a carer’s real attendance.',
      'Requests — every request they’ve raised (e.g. asking to drop a shift), and how it was decided. When you approve or decline from Staffing, the outcome shows here.',
      'Clock — their raw clock history: each tap, whether it was on-site or off, and how far. Notes and Mileage tabs hold their written notes and travel.',
      'Cover: when a carer claims a cover shift, it becomes a normal assigned visit and appears under Visits — no separate step.',
      'Edit updates their details; Deactivate removes a leaver from the live roster while keeping all their history intact.',
    ],
  },
  {
    id: 'messages', icon: 'chat', shot: '09-messages.png',
    title: 'Message carers and the team',
    intro: 'Messages is the office’s chat with carers — direct messages to one person, groups, and channels like #team-updates that reach everyone.',
    steps: [
      'The left list holds your channels, groups and direct messages, newest first, with a badge for unread ones. Use + to start a new conversation.',
      'Type a message, or tap a quick reply ("On my way", "Running late", "Can you cover this?"…) for the common ones. The paperclip attaches a photo or file.',
      'Read receipts (top right) show who has seen your latest message; Chase unread nudges anyone who hasn’t.',
      'Shift context shows the live picture for the carer you’re talking to — their hours and punctuality, with a jump to their rota — so you have what you need without leaving the chat.',
    ],
  },
  {
    id: 'reports', icon: 'trend', shot: '10-reports.png',
    title: 'Read the reports and export a pack',
    intro: 'Reports summarises attendance, punctuality, hours and exceptions across every visit, from real clock records.',
    steps: [
      'Switch between Weekly, Monthly and Yearly. A dash ("—") means there was nothing to measure in that period, not zero.',
      'The tiles read left to right: attendance, on-time rate, on-site clock-ins, unresolved exceptions, verified hours, care tasks done.',
      'Export report pack downloads the full pack (CSV or Excel) for the period on screen.',
    ],
  },
  {
    id: 'profile-notifications', icon: 'bell', shot: '17-notifications.png',
    title: 'Your profile and notifications',
    intro: 'The bell (top right) is your alerts; your name opens your own profile and preferences.',
    steps: [
      'The bell shows a count of unread notifications — new alerts, decided requests, cover claims. Click it to read them; opening one takes you to what it’s about.',
      'Notifications arrive live (the badge updates without refreshing) and can also reach you as a browser/phone push if you’ve allowed it.',
      'Your name opens your profile — update your own details and, where offered, your notification preferences (which alerts reach you, and how).',
    ],
  },
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

  // The concept blocks live INSIDE the walkthrough they explain (shift states +
  // escalation under Exceptions; automated behaviours under Rota) rather than in
  // a detached section — so the diagram sits next to the screen it's about.
  const conceptTitle = (t) => (
    <div style={s('font-size:12px;font-weight:800;color:var(--d-ink);text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 10px;padding-top:16px;border-top:1px solid var(--d-border)')}>{t}</div>
  );

  const shiftStatesBlock = (
    <div data-tour="guide-states">
      {conceptTitle('The states a visit moves through')}
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
      <div style={s('font-size:11px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.06em;margin:16px 0 8px')}>Exception branches</div>
      <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
        {BRANCH.map((st) => (
          <div key={st} style={s('display:flex;align-items:center;gap:8px;border:1px dashed var(--d-border);border-radius:12px;padding:9px 12px')}>
            <span style={{ ...s('width:8px;height:8px;border-radius:50%'), background: dot(st) }} />
            <span style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{LIFECYCLE_LABELS[st]}</span>
            <span style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{DESC[st]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const escalationBlock = (
    <div>
      {conceptTitle('How a missed clock-in escalates')}
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
    </div>
  );

  const behavioursBlock = (
    <div>
      {conceptTitle('Rules the system applies without asking')}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:9px')}>
        {behaviours.map((r) => (
          <div key={r.t} style={s('border:1px solid var(--d-border);border-radius:14px;padding:12px 14px')}>
            <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{r.t}</div>
            <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:2px;line-height:1.5')}>{r.d}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const conceptFor = { exceptions: <>{shiftStatesBlock}{escalationBlock}</>, rota: behavioursBlock };

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Intro + quick jump to a task */}
      <Panel>
        <PanelTitle hint="A reference for the office — how to run the day-to-day from this console">Using the console</PanelTitle>
        <div style={s('font-size:13px;font-weight:500;color:var(--d-ink2);line-height:1.6;margin-bottom:14px')}>
          Everything below walks through a real task, with a picture of the screen you’ll be on. Start with the one you need — nothing here changes any records, so it’s safe to click around and follow along.
        </div>
        <div style={s('display:flex;flex-wrap:wrap;gap:8px')}>
          {WALKTHROUGHS.map((w) => (
            <a key={w.id} href={`#${w.id}`} className="hv"
              style={{ ...s('display:inline-flex;align-items:center;gap:7px;border:1px solid var(--d-border);border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:700;color:var(--d-ink2);text-decoration:none;background:var(--d-card)'), '--hbg': 'var(--d-card-hover)' }}>
              <Icon name={w.icon} size={14} />{w.title}
            </a>
          ))}
        </div>
      </Panel>

      {/* Task walkthroughs with real screenshots */}
      {WALKTHROUGHS.map((w) => (
        <Panel key={w.id}>
          <div id={w.id} style={{ scrollMarginTop: 20 }} />
          <div style={s('display:flex;align-items:center;gap:10px;margin-bottom:4px')}>
            <div style={s('width:30px;height:30px;border-radius:9px;background:var(--d-primary-soft);color:var(--d-primary-deep);display:flex;align-items:center;justify-content:center;flex:none')}><Icon name={w.icon} size={16} /></div>
            <div style={s('font-size:16px;font-weight:800;color:var(--d-ink)')}>{w.title}</div>
          </div>
          <div style={s('font-size:13px;font-weight:500;color:var(--d-ink2);line-height:1.6;margin-bottom:14px')}>{w.intro}</div>
          <div style={s('display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px;align-items:start')}>
            <a href={`/guide/${w.shot}`} target="_blank" rel="noreferrer" style={s('display:block;border:1px solid var(--d-border);border-radius:14px;overflow:hidden;background:var(--d-panel)')}>
              <img src={`/guide/${w.shot}`} alt={w.title} loading="lazy" style={s('display:block;width:100%;height:auto')} />
            </a>
            <ol style={s('display:flex;flex-direction:column;gap:11px;margin:0;padding:0;list-style:none;counter-reset:step')}>
              {w.steps.map((step, i) => (
                <li key={i} style={s('display:flex;gap:11px;align-items:flex-start')}>
                  <span style={s('width:22px;height:22px;border-radius:50%;background:var(--d-primary);color:var(--d-primary-ink);font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none;margin-top:1px')}>{i + 1}</span>
                  <span style={s('font-size:13px;font-weight:500;color:var(--d-ink2);line-height:1.55')}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {/* The relevant concept diagram sits right under the screen it explains. */}
          {conceptFor[w.id]}
        </Panel>
      ))}

      {/* How the record is governed — cross-cutting, so it stays on its own */}
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
