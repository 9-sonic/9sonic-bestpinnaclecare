import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getCover, createCoverOffer, acceptCoverOffer, declineCoverOffer, assignEmployee, listEmployees } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import { formatTimeRange, formatDate } from '../api/format.js';
import { Panel, PanelTitle, StatCard, Tag, Avatar, SeverityPill, Button, SegTabs } from '../ds/console.jsx';

const OFFER_STATE = {
  accepted: { label: 'Accepted', tone: 'success' },
  pending: { label: 'Awaiting reply', tone: 'warning' },
  declined: { label: 'Declined', tone: 'muted' },
  withdrawn: { label: 'Withdrawn', tone: 'muted' },
};
// Priority derived from how soon the visit starts (no separate call-off model).
function priorityOf(startIso) {
  const h = (new Date(startIso) - Date.now()) / 3600000;
  return h < 2 ? 'high' : h < 24 ? 'medium' : 'low';
}
function noticeOf(startIso) {
  const mins = Math.round((new Date(startIso) - Date.now()) / 60000);
  if (mins < 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  if (mins < 60 * 24) return `in ${Math.round(mins / 60)}h`;
  return `in ${Math.round(mins / 1440)} days`;
}

export default function CoverPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [carers, setCarers] = useState([]);
  // Default to "Unfilled" so the primary view shows only what genuinely still
  // needs cover — offered visits move to their own "Awaiting reply" tab.
  const [filter, setFilter] = useState('open');
  const [selectedId, setSelectedId] = useState(null);
  const [picked, setPicked] = useState(null);

  const load = useCallback(async () => {
    const b = await getCover();
    setBoard(b);
    setSelectedId((prev) => prev ?? b.open_shifts?.[0]?.visit?.id ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([load(), listEmployees().then((e) => active && setCarers(e.filter((x) => x.active))).catch(() => {})])
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [load]);

  const shifts = board?.open_shifts ?? [];
  const counts = board?.counts ?? {};
  const hoursUncovered = shifts.filter((sh) => sh.state !== 'filled').reduce((a, sh) => a + (sh.visit.hours || 0), 0);
  const list = shifts.filter((sh) => (filter === 'all' ? true : sh.state === filter));
  const selected = shifts.find((sh) => sh.visit.id === selectedId) ?? null;
  const offeredIds = useMemo(() => new Set((selected?.offers ?? []).map((o) => o.employee_id)), [selected]);

  async function offer() {
    if (!selected || !picked) return;
    try { await createCoverOffer(selected.visit.id, picked); toast.info('Offer sent to the carer'); setPicked(null); await load(); }
    catch (err) { toast.error(err.message || 'Could not send offer'); }
  }
  async function assign() {
    if (!selected || !picked) return;
    const name = carers.find((c) => c.id === picked)?.full_name ?? 'Carer';
    try { await assignEmployee({ visitId: selected.visit.id, employeeId: picked }); toast.success(`${name} assigned — visit filled`); setSelectedId(null); setPicked(null); await load(); }
    catch (err) { toast.error(err.message || 'Could not assign'); }
  }
  async function respond(offerId, accept) {
    try {
      if (accept) { await acceptCoverOffer(offerId); toast.success('Offer accepted — visit filled'); setSelectedId(null); }
      else { await declineCoverOffer(offerId); toast.info('Offer declined'); }
      await load();
    } catch (err) { toast.error(err.message); }
  }

  if (loading) return <Spinner fullscreen />;

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        <StatCard label="Unfilled visits" value={counts.open ?? 0} hint="No carer, no offer yet" tone="danger" icon="alert" live />
        <StatCard label="Awaiting a reply" value={counts.offered ?? 0} hint="Offered, nobody accepted" tone="warning" icon="send" />
        <StatCard label="Filled" value={counts.filled ?? 0} hint="Cover confirmed" tone="success" icon="check" />
        <StatCard label="Hours uncovered" value={`${hoursUncovered.toFixed(1)}h`} hint="Across the next 14 days" tone="primary" icon="clock" />
      </div>

      {shifts.length === 0 ? (
        <Panel><div style={s('display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 20px')}>
          <div style={s('width:56px;height:56px;border-radius:18px;background:var(--d-ok-bg);display:flex;align-items:center;justify-content:center;color:var(--d-ok-ink)')}><Icon name="check" size={26} /></div>
          <div style={s('font-size:15px;font-weight:700;color:var(--d-ink)')}>Every visit is covered</div>
          <div style={s('font-size:13px;font-weight:500;color:var(--d-muted)')}>No unfilled visits in the next 14 days.</div>
        </div></Panel>
      ) : (
        <div style={s('display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:16px;align-items:start')}>
          <div style={s('display:flex;flex-direction:column')}>
            <span data-tour="cover-tabs"><SegTabs active={filter} onSelect={setFilter}
              tabs={[{ key: 'open', label: 'Unfilled', count: counts.open ?? 0 }, { key: 'offered', label: 'Offered', count: counts.offered ?? 0 }, { key: 'filled', label: 'Filled', count: counts.filled ?? 0 }, { key: 'all', label: 'All', count: shifts.length }]} /></span>
            <div data-tour="cover-list" style={s('background:var(--d-card);border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:10px;margin-top:12px')}>
              {list.map((sh) => {
                const on = sh.visit.id === selectedId;
                return (
                  <div key={sh.visit.id} onClick={() => { setSelectedId(sh.visit.id); setPicked(null); }} className="hv"
                    style={{ ...s('border-radius:16px;padding:14px;cursor:pointer'), background: 'var(--d-panel)', border: on ? '1.5px solid var(--d-primary)' : '1.5px solid transparent', '--hbg': 'var(--d-sage)' }}>
                    <div style={s('display:flex;align-items:flex-start;gap:8px')}>
                      <div style={s('flex:1;min-width:0')}>
                        <div style={s('font-size:13px;font-weight:700;color:var(--d-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{sh.visit.client}</div>
                        <div className="d-num" style={s('font-size:11.5px;font-weight:500;color:var(--d-muted)')}>{formatDate(sh.visit.scheduled_start)} · {formatTimeRange(sh.visit.scheduled_start, sh.visit.scheduled_end)} · {sh.visit.hours}h</div>
                      </div>
                      <SeverityPill severity={priorityOf(sh.visit.scheduled_start)} />
                    </div>
                    <div style={s('display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:9px')}>
                      <Tag tone={sh.state === 'filled' ? 'success' : sh.state === 'offered' ? 'warning' : 'danger'}>{sh.state === 'filled' ? 'Cover confirmed' : sh.state === 'offered' ? 'Awaiting reply' : 'Needs cover'}</Tag>
                      <span style={s('margin-left:auto;font-size:10.5px;font-weight:600;color:var(--d-muted)')}>{noticeOf(sh.visit.scheduled_start)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selected && (
            <div style={s('display:flex;flex-direction:column;gap:16px')}>
              <Panel>
                <div style={s('display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap')}>
                  <div style={s('flex:1;min-width:0')}>
                    <div style={s('font-size:18px;font-weight:700;color:var(--d-ink);letter-spacing:-0.3px')}>{selected.visit.client} · {formatTimeRange(selected.visit.scheduled_start, selected.visit.scheduled_end)}</div>
                    <div style={s('font-size:12.5px;font-weight:500;color:var(--d-muted);margin-top:2px')}>{formatDate(selected.visit.scheduled_start)} · {selected.visit.address || 'No address'}</div>
                  </div>
                  <Tag tone="muted">{selected.visit.hours}h</Tag>
                </div>
                {selected.visit.notes && <div style={s('margin-top:12px;background:var(--d-panel);border-radius:14px;padding:13px 15px;font-size:12.5px;font-weight:500;color:var(--d-ink2);line-height:1.5')}>{selected.visit.notes}</div>}
              </Panel>

              <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:16px')}>
                <Panel>
                  <PanelTitle hint="Active carers — pick one to offer or assign">Who can take it</PanelTitle>
                  <div style={s('display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto')}>
                    {carers.map((c) => {
                      const active = picked === c.id;
                      return (
                        <div key={c.id} onClick={() => setPicked(c.id)} className="hv"
                          style={{ ...s('border-radius:14px;padding:11px 13px;cursor:pointer;display:flex;align-items:center;gap:11px'), background: 'var(--d-panel)', border: active ? '1.5px solid var(--d-primary)' : '1.5px solid transparent', '--hbg': 'var(--d-sage)' }}>
                          <Avatar initials={(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')} size="sm" />
                          <div style={s('flex:1;min-width:0')}>
                            <div style={s('font-size:13px;font-weight:700;color:var(--d-ink)')}>{c.full_name}</div>
                            <div style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>{c.role === 'senior_carer' ? 'Senior carer' : 'Carer'}</div>
                          </div>
                          {offeredIds.has(c.id) && <Tag tone="warning">Offered</Tag>}
                        </div>
                      );
                    })}
                    {carers.length === 0 && <div style={s('font-size:12.5px;color:var(--d-muted);padding:8px')}>No active carers.</div>}
                  </div>
                  {canManage && (
                    <div style={s('display:flex;gap:8px;flex-wrap:wrap;margin-top:14px')}>
                      <Button variant="primary" icon="plus" disabled={!picked} onClick={assign}>Assign directly</Button>
                      <Button icon="send" disabled={!picked || offeredIds.has(picked)} onClick={offer}>Offer</Button>
                    </div>
                  )}
                </Panel>

                <Panel>
                  <PanelTitle hint="Updates as carers respond">Offers and replies</PanelTitle>
                  {selected.offers.length ? (
                    <div style={s('display:flex;flex-direction:column;gap:10px')}>
                      {selected.offers.map((o) => (
                        <div key={o.id} style={s('display:flex;align-items:center;gap:11px;border:1px solid var(--d-border);border-radius:14px;padding:11px 13px')}>
                          <Avatar initials={(o.employee_name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')} size="sm" />
                          <div style={s('flex:1;min-width:0')}>
                            <div style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{o.employee_name}</div>
                            <div className="d-num" style={s('font-size:11px;font-weight:500;color:var(--d-muted)')}>Sent {formatDate(o.offered_at)}{o.responded_at ? ` · replied ${formatDate(o.responded_at)}` : ''}</div>
                            {o.note && <div style={s('font-size:11.5px;font-weight:500;color:var(--d-ink2);font-style:italic;margin-top:3px;line-height:1.45')}>“{o.note}”</div>}
                          </div>
                          {o.state === 'pending' ? (
                            <div style={s('display:flex;gap:6px')}>
                              {canManage && <Button size="sm" variant="primary" onClick={() => respond(o.id, true)}>Accept</Button>}
                              {canManage && <Button size="sm" onClick={() => respond(o.id, false)}>Decline</Button>}
                            </div>
                          ) : <Tag tone={OFFER_STATE[o.state]?.tone ?? 'muted'}>{OFFER_STATE[o.state]?.label ?? o.state}</Tag>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={s('border:1px dashed var(--d-border);border-radius:14px;padding:28px 16px;text-align:center;font-size:12.5px;font-weight:500;color:var(--d-muted)')}>No offers yet. Pick a carer to offer or assign.</div>
                  )}
                  <div style={s('margin-top:12px;background:var(--d-panel);border-radius:14px;padding:12px 14px;font-size:11.5px;font-weight:500;color:var(--d-muted);line-height:1.55')}>Accepting an offer creates the assignment and records who accepted and when in the audit trail.</div>
                </Panel>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
