import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAlerts, acknowledgeAlert, resolveAlert } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatTime, formatDate } from '../api/format.js';
import { Panel, PanelTitle, StatCard, Tag, Avatar, Button, SegTabs } from '../ds/console.jsx';

const LABELS = {
  missed_visit: 'Visit missed', no_clock_out: 'No clock out recorded', geo_anomaly: 'Clocked in away from the address',
  visit_late: 'Carer is late', unassigned_visit: 'Visit has no carer', clock_in_failed: 'Carer could not clock in',
};
const ICON = { missed_visit: 'alert', no_clock_out: 'clock', geo_anomaly: 'pin', visit_late: 'clock', unassigned_visit: 'user', clock_in_failed: 'offline' };
const STATE_TONE = { open: 'danger', acknowledged: 'warning', resolved: 'success' };
const label = (t) => LABELS[t] ?? (t ?? '').replace(/_/g, ' ');
const carerInits = (name) => (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('');

export default function AlertsPage() {
  const toast = useToast();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    const a = (await listAlerts()) ?? [];
    setAlerts(a);
    setSelectedId((prev) => (a.some((x) => x.id === prev) ? prev : a.find((x) => x.state !== 'resolved')?.id ?? a[0]?.id ?? null));
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const counts = useMemo(() => ({
    open: alerts.filter((a) => a.state === 'open').length,
    acknowledged: alerts.filter((a) => a.state === 'acknowledged').length,
    resolved: alerts.filter((a) => a.state === 'resolved').length,
    high: alerts.filter((a) => a.severity === 'high' && a.state !== 'resolved').length,
  }), [alerts]);

  async function ack(a) { try { await acknowledgeAlert(a.id); toast.info('Acknowledged — carer notified'); await load(); } catch (e) { toast.error(e.message); } }
  async function resolve(a) { try { await resolveAlert(a.id, 'Resolved from the alert inbox'); toast.success('Resolved and recorded'); await load(); } catch (e) { toast.error(e.message); } }

  if (loading) return <Spinner fullscreen />;

  const filtered = alerts.filter((a) => (filter === 'all' ? true : filter === 'open' ? a.state !== 'resolved' : a.state === filter));
  const selected = alerts.find((a) => a.id === selectedId) ?? null;
  const tabDefs = [
    { key: 'open', label: 'Open', icon: 'bell', count: alerts.filter((a) => a.state !== 'resolved').length },
    { key: 'acknowledged', label: 'Acknowledged', icon: 'check', count: counts.acknowledged },
    { key: 'resolved', label: 'Resolved', icon: 'shield', count: counts.resolved },
    { key: 'all', label: 'All', icon: 'menu', count: alerts.length },
  ];

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        <StatCard label="New" value={counts.open} hint="No manager response yet" tone="danger" icon="bell" live />
        <StatCard label="Acknowledged" value={counts.acknowledged} hint="Seen, carer told to carry on" tone="warning" icon="check" />
        <StatCard label="High severity" value={counts.high} hint="Client welfare at risk" tone="magenta" icon="shield" />
        <StatCard label="Resolved today" value={counts.resolved} hint="Recorded and audited" tone="success" icon="check" />
      </div>

      {alerts.length === 0 ? (
        <Panel><div style={s('display:flex;flex-direction:column;align-items:center;gap:10px;padding:52px 24px')}>
          <div style={s('width:60px;height:60px;border-radius:18px;background:var(--d-ok-bg);display:flex;align-items:center;justify-content:center;color:var(--d-ok-ink)')}><Icon name="check" size={28} /></div>
          <div style={s('font-size:16px;font-weight:700;color:var(--d-ink)')}>Inbox is clear</div>
          <div style={s('font-size:13px;font-weight:500;color:var(--d-muted)')}>Failed and missed clock-ins land here.</div>
        </div></Panel>
      ) : (
        <div style={s('display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:16px;align-items:start')}>
          {/* Inbox */}
          <div style={s('display:flex;flex-direction:column')}>
            <SegTabs tabs={tabDefs} active={filter} onSelect={setFilter} />
            <div style={s('background:var(--d-card);border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:9px;margin-top:12px')}>
              {filtered.length === 0 ? (
                <div style={s('padding:32px 16px;text-align:center;font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Nothing in this view.</div>
              ) : filtered.map((a) => {
                const on = a.id === selectedId;
                return (
                  <div key={a.id} onClick={() => setSelectedId(a.id)} className="hv"
                    style={{ ...s('border-radius:14px;padding:12px;cursor:pointer;display:flex;align-items:center;gap:11px'), background: 'var(--d-card)', border: on ? '1.5px solid var(--d-primary)' : '1.5px solid transparent', '--hbg': 'var(--d-card-hover)' }}>
                    <Avatar initials={a.carer ? carerInits(a.carer) : '!'} size="sm" />
                    <div style={s('flex:1;min-width:0')}>
                      <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{a.carer ?? label(a.alert_type)}{a.client ? ` → ${a.client}` : ''}</div>
                      <div style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>{label(a.alert_type)}{a.window ? ` · ${a.window}` : ''}</div>
                    </div>
                    <div style={s('display:flex;flex-direction:column;gap:4px;align-items:flex-end')}>
                      <Tag tone={STATE_TONE[a.state] ?? 'muted'}>{a.state}</Tag>
                      {a.severity === 'high' && <span style={s('font-size:9.5px;font-weight:700;color:var(--d-danger-ink)')}>HIGH</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          {selected && (
            <div style={s('display:flex;flex-direction:column;gap:16px')}>
              <Panel>
                <div style={s('display:flex;align-items:flex-start;gap:12px')}>
                  <div style={{ ...s('width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex:none'), background: selected.severity === 'high' ? 'var(--d-danger-bg)' : 'var(--d-warn-bg)', color: selected.severity === 'high' ? 'var(--d-danger-ink)' : 'var(--d-warn-ink)' }}><Icon name={ICON[selected.alert_type] ?? 'alert'} size={20} /></div>
                  <div style={s('flex:1;min-width:0')}>
                    <div style={s('font-size:18px;font-weight:700;color:var(--d-ink)')}>{label(selected.alert_type)}</div>
                    <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{selected.carer ? `${selected.carer} → ` : ''}{selected.client ?? `${selected.subject_type} ${selected.subject_id}`}{selected.window ? ` · ${selected.window}` : ''}</div>
                  </div>
                  <Tag tone={STATE_TONE[selected.state] ?? 'muted'}>{selected.state}</Tag>
                </div>
                <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px')}>
                  {[['Raised', `${formatDate(selected.raised_at)} ${formatTime(selected.raised_at)}`], ['Severity', selected.severity ?? 'normal']].map(([l, v]) => (
                    <div key={l} style={s('background:var(--d-panel);border-radius:12px;padding:11px 13px')}>
                      <div style={s('font-size:10px;font-weight:700;color:var(--d-muted);text-transform:uppercase;letter-spacing:0.05em')}>{l}</div>
                      <div style={s('font-size:13px;font-weight:700;color:var(--d-ink);margin-top:3px;text-transform:capitalize')}>{v}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelTitle hint="Acknowledge so the carer knows you have seen it, then resolve with a record">Actions</PanelTitle>
                <div style={s('display:flex;gap:10px;flex-wrap:wrap')}>
                  {selected.state === 'open' && <Button variant="primary" icon="check" onClick={() => ack(selected)}>Acknowledge</Button>}
                  {selected.state !== 'resolved' && <Button icon="shield" onClick={() => resolve(selected)}>Resolve</Button>}
                  {selected.state === 'resolved' && <div style={s('font-size:12.5px;font-weight:600;color:var(--d-ok-ink);display:flex;align-items:center;gap:7px')}><Icon name="check" size={16} /> Resolved{selected.resolved_at ? ` at ${formatTime(selected.resolved_at)}` : ''}</div>}
                </div>
                <div style={s('margin-top:14px;background:var(--d-note-bg);border-radius:14px;padding:13px 15px;font-size:11.5px;font-weight:500;color:var(--d-note-ink);line-height:1.55')}>Resolving records who cleared the alert and when in the audit trail. A manager-attested clock-in is flagged as manager-entered, never as a device capture.</div>
              </Panel>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
