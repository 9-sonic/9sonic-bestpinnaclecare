import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { listRequests, approveRequest, declineRequest } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import { formatDate } from '../api/format.js';
import { Panel, PanelTitle, StatCard, Tag, Avatar, Button, SegTabs } from '../ds/console.jsx';

const KIND = {
  swap: { label: 'Swap', tone: 'info' },
  drop: { label: 'Drop', tone: 'danger' },
  overtime: { label: 'Overtime', tone: 'success' },
  availability: { label: 'Availability', tone: 'warning' },
  leave: { label: 'Leave', tone: 'warning' },
};
const inits = (name) => (name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const STATE_TONE = { pending: 'warning', approved: 'success', declined: 'danger' };
const STATE_LABEL = { pending: 'Pending', approved: 'Approved', declined: 'Declined' };

function ago(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Honest consequence guidance. The backend records the decision and does NOT
// auto-move the rota (see RequestsController) — so this states the real next
// step, it does not invent an automated rota impact.
const IMPACT_TONE = { ok: { icon: 'check', color: 'var(--d-ok-ink)' }, warn: { icon: 'alert', color: 'var(--d-warn-ink)' }, risk: { icon: 'alert', color: 'var(--d-danger-ink)' } };
const CONSEQUENCE = {
  swap: [['ok', 'Records the swap and notifies both carers.'], ['warn', 'You then move the visits on the rota — the swap is not applied automatically.']],
  drop: [['risk', 'Frees the carer from the visit, which will need re-covering.'], ['warn', 'Offer it on the cover board so it does not become a missed visit.']],
  overtime: [['ok', 'Records the overtime approval and notifies the carer.'], ['ok', 'Assign them to the extra visit on the rota to make it live.']],
  availability: [['warn', 'Nothing moves automatically — reflect the new availability when you build the rota.']],
  leave: [['risk', 'Any visits already scheduled in that period will need re-covering.'], ['warn', 'Records the leave decision against the carer.']],
};

export default function RequestsPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = (await listRequests()) ?? [];
    setRows(r);
    setSelectedId((prev) => (prev && r.some((x) => x.id === prev) ? prev : (r.find((x) => x.state === 'pending')?.id ?? r[0]?.id ?? null)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const pending = useMemo(() => all.filter((r) => r.state === 'pending'), [all]);
  const byKind = (k) => pending.filter((r) => r.kind === k).length;

  const list = useMemo(() => all.filter((r) => {
    if (filter === 'pending') return r.state === 'pending';
    if (filter === 'decided') return r.state !== 'pending';
    return r.kind === filter;
  }), [all, filter]);
  const selected = all.find((r) => r.id === selectedId) ?? null;

  async function decide(verb) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const note = reply.trim() || undefined;
      if (verb === 'approve') await approveRequest(selected.id, note); else await declineRequest(selected.id, note);
      toast.success(`${verb === 'approve' ? 'Approved' : 'Declined'} — ${selected.employee_name} has been notified`);
      setReply(''); await load();
    } catch (err) { toast.error(err.message || 'Could not record the decision'); } finally { setBusy(false); }
  }

  if (!rows) return <Spinner fullscreen />;

  const filterTabs = [
    { key: 'pending', label: 'Pending', count: pending.length },
    { key: 'swap', label: 'Swaps' }, { key: 'drop', label: 'Drops' },
    { key: 'overtime', label: 'Overtime' }, { key: 'availability', label: 'Availability' },
    { key: 'decided', label: 'Decided' },
  ];

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Stat cards */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px')}>
        <StatCard label="Awaiting your decision" value={pending.length} hint="Carer requests to action" tone="warning" icon="note" live />
        <StatCard label="Swaps" value={byKind('swap')} hint="Shift exchanges" tone="primary" icon="sync" />
        <StatCard label="Drops needing cover" value={byKind('drop')} hint="Will need re-covering" tone="danger" icon="alert" />
        <StatCard label="Overtime offered" value={byKind('overtime')} hint="Carers volunteering for extra" tone="success" icon="clock" />
      </div>

      {all.length === 0 ? (
        <Panel><div style={s('display:flex;flex-direction:column;align-items:center;gap:10px;padding:52px 20px')}>
          <div style={s('width:56px;height:56px;border-radius:18px;background:var(--d-sage);display:flex;align-items:center;justify-content:center;color:var(--d-muted)')}><Icon name="note" size={26} /></div>
          <div style={s('font-size:15px;font-weight:700;color:var(--d-ink)')}>Nothing here</div>
          <div style={s('font-size:13px;font-weight:500;color:var(--d-muted)')}>Swaps, drops, overtime and availability changes from the carer app land here.</div>
        </div></Panel>
      ) : (
        <div style={{ ...s('display:grid;gap:16px;align-items:start'), gridTemplateColumns: 'minmax(0,400px) minmax(0,1fr)' }}>
          {/* Queue */}
          <Panel>
            <PanelTitle hint="Newest first — pending shown by default">Request queue</PanelTitle>
            <div style={s('margin-bottom:12px')}><SegTabs tabs={filterTabs} active={filter} onSelect={setFilter} /></div>
            {list.length === 0 ? (
              <div style={s('padding:36px 12px;text-align:center;font-size:13px;font-weight:500;color:var(--d-muted)')}>No requests match this filter.</div>
            ) : (
              <div style={s('display:flex;flex-direction:column;gap:9px')}>
                {list.map((r) => {
                  const k = KIND[r.kind] ?? { label: r.kind, tone: 'muted' };
                  const on = r.id === selectedId;
                  return (
                    <button key={r.id} type="button" onClick={() => { setSelectedId(r.id); setReply(''); }}
                      style={{ ...s('width:100%;text-align:left;border-radius:14px;padding:13px;cursor:pointer;background:var(--d-panel)'), border: on ? '1.5px solid var(--d-primary)' : '1.5px solid var(--d-border)', fontFamily: 'inherit' }}>
                      <div style={s('display:flex;align-items:flex-start;gap:11px')}>
                        <Avatar initials={inits(r.employee_name)} size="sm" />
                        <div style={s('flex:1;min-width:0')}>
                          <div style={s('font-size:13px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.employee_name}</div>
                          <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{r.summary}</div>
                        </div>
                        <span className="d-num" style={s('font-size:10.5px;font-weight:500;color:var(--d-faint);flex:none')}>{ago(r.created_at)}</span>
                      </div>
                      <div style={s('display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;padding-left:43px')}>
                        <Tag tone={k.tone}>{k.label}</Tag>
                        <Tag tone={STATE_TONE[r.state] ?? 'muted'}>{STATE_LABEL[r.state] ?? r.state}</Tag>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Detail */}
          {selected && (
            <div style={s('display:flex;flex-direction:column;gap:16px')}>
              <Panel>
                <div style={s('display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px')}>
                  <div style={s('display:flex;align-items:center;gap:12px;min-width:0')}>
                    <Avatar initials={inits(selected.employee_name)} />
                    <div style={s('min-width:0')}>
                      <div style={s('font-size:18px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>{selected.summary}</div>
                      <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{selected.employee_name} · submitted {formatDate(selected.created_at)}</div>
                    </div>
                  </div>
                  <Tag tone={(KIND[selected.kind] ?? {}).tone ?? 'muted'}>{(KIND[selected.kind] ?? {}).label ?? selected.kind}</Tag>
                </div>
                {selected.detail && <div style={s('margin-top:14px;background:var(--d-panel);border-radius:14px;padding:13px 15px;font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.6')}>{selected.detail}</div>}
              </Panel>

              <div style={{ ...s('display:grid;gap:16px'), gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
                <Panel>
                  <PanelTitle hint="This queue records the decision — it does not move the rota for you">What approving does</PanelTitle>
                  <div style={s('display:flex;flex-direction:column;gap:8px')}>
                    {(CONSEQUENCE[selected.kind] ?? [['warn', 'Records the decision and notifies the carer.']]).map(([tone, text]) => {
                      const m = IMPACT_TONE[tone];
                      return (
                        <div key={text} style={s('display:flex;gap:10px;border:1px solid var(--d-border);border-radius:12px;padding:10px 13px')}>
                          <Icon name={m.icon} size={15} style={{ color: m.color, flex: 'none', marginTop: '1px' }} />
                          <span style={s('font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.45')}>{text}</span>
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(selected.payload ?? {}).length > 0 && (
                    <div style={s('margin-top:12px;border-top:1px solid var(--d-border);padding-top:12px;display:flex;flex-direction:column;gap:7px')}>
                      {Object.entries(selected.payload).map(([k, v]) => (
                        <div key={k} style={s('display:flex;gap:10px;font-size:12px')}>
                          <span style={s('width:120px;flex:none;font-weight:600;color:var(--d-muted);text-transform:capitalize')}>{k.replace(/_/g, ' ')}</span>
                          <span style={s('font-weight:600;color:var(--d-ink2)')}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelTitle hint="Your reply goes to the carer's app and is kept with the request">Decision</PanelTitle>
                  {selected.state === 'pending' && !canManage ? (
                    <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted)')}>Awaiting a manager decision. Your role can view requests but not approve or decline them.</div>
                  ) : selected.state === 'pending' ? (
                    <>
                      <div style={s('display:flex;flex-direction:column;gap:6px')}>
                        <span style={s('font-size:11.5px;font-weight:700;color:var(--d-ink2)')}>Message to the carer</span>
                        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Optional for an approval, expected for a decline."
                          style={{ ...s('border-radius:12px;border:1px solid var(--d-border);background:var(--d-field);padding:10px 13px;font-size:12.5px;font-weight:500;color:var(--d-ink);outline:none;width:100%;resize:vertical;line-height:1.5'), fontFamily: 'inherit' }} />
                      </div>
                      <div style={s('display:flex;flex-wrap:wrap;gap:8px;margin-top:12px')}>
                        <Button variant="primary" icon="check" onClick={() => decide('approve')}>{busy ? 'Saving…' : 'Approve'}</Button>
                        <Button variant="danger" icon="close" onClick={() => decide('decline')}>Decline</Button>
                      </div>
                    </>
                  ) : (
                    <div style={s('background:var(--d-panel);border-radius:14px;padding:14px 16px')}>
                      <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{STATE_LABEL[selected.state]}{selected.decided_by ? ` by ${selected.decided_by}` : ''}</div>
                      <div style={s('font-size:11.5px;font-weight:500;color:var(--d-muted);margin-top:4px;line-height:1.55')}>{selected.decided_at ? `${formatDate(selected.decided_at)} · ` : ''}recorded in the audit trail. Reopen only by raising a new request.</div>
                      {selected.decision_note && <div style={s('margin-top:8px;font-size:12.5px;font-weight:500;color:var(--d-ink2);font-style:italic')}>“{selected.decision_note}”</div>}
                    </div>
                  )}
                  <div style={s('margin-top:12px;background:var(--d-note-bg);border-radius:12px;padding:11px 14px;font-size:11px;font-weight:500;color:var(--d-note-ink);line-height:1.5')}>The decision and your message are recorded against the request and in the audit trail. The rota is not changed automatically — you apply the change so the record stays honest.</div>
                </Panel>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
