import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAlerts } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { Panel, PanelTitle, Tag, Button, TableWrap, Th, Td, Row } from '../ds/console.jsx';
import { LIFECYCLE_LABELS, LIFECYCLE_TONE, formatTime, formatDate } from '../api/format.js';

// Live escalation record. The how-it-works explainer (shift states, the tiered
// escalation pathway, automated behaviours) moved to the Guide page — this page
// is now just the real alerts the system has raised.
const L2TAG = { neutral: 'muted', info: 'info', warn: 'warning', active: 'info', danger: 'danger', success: 'success' };
const DESC = {
  in_progress: 'Carer clocked in and currently delivering care.',
  completed: 'Shift finished and verified.',
  late: 'Clock in landed after the grace period.',
  pending_review: 'Sitting with a manager in the exceptions queue.',
};

export default function LifecyclePage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listAlerts()
      .then((al) => { if (active) setAlerts(al ?? []); })
      .catch(() => { if (active) setAlerts([]); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <Spinner fullscreen />;

  const tierOf = (sev) => (sev === 'high' ? 3 : sev === 'medium' ? 2 : 1);

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Pointer to the explainer, now on the Guide */}
      <div style={s('background:var(--d-note-bg);border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px')}>
        <Icon name="info" size={16} />
        <div style={s('flex:1;min-width:0;font-size:12.5px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>How shift states, escalation tiers and the automated rules work is in the Guide.</div>
        <Button size="sm" icon="chevronRight" onClick={() => navigate('/guide')}>Open the Guide</Button>
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
