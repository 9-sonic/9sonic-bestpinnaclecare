import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/common/Icon.jsx';
import { s } from '../lib/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getReports, exportReportPack } from '../api/index.js';
import Spinner from '../components/common/Spinner.jsx';
import { Panel, PanelTitle, Tag, Button, TableWrap, Th, Td, Row, LineChart, BarChart, StackedBars, DonutChart, CHART, SegTabs } from '../ds/console.jsx';

export const RANGES = [{ id: 'week', label: 'Weekly', days: 7 }, { id: 'month', label: 'Monthly', days: 30 }, { id: 'year', label: 'Yearly', days: 365 }];
const SEV_COLOR = { high: CHART.danger, normal: CHART.warn };
const SEV_LABEL = { high: 'High', normal: 'Normal' };

// The [from, to] ISO window for a range id — shared by the Overview fetch and the
// report-pack export so they always cover the same period.
export function rangeWindow(rangeId) {
  const days = RANGES.find((r) => r.id === rangeId)?.days ?? 7;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Report-pack CSV/XLSX download for a range. Lifted out of the Overview hero so
// it can live on the Exports tab; same handler, same period as what's on screen.
export function ReportPackExport({ range }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const pull = async (type) => {
    setExporting(true);
    try {
      const { from, to } = rangeWindow(range);
      await exportReportPack(from, to, type);
      toast.success(`${type.toUpperCase()} report pack downloaded`);
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div style={s('display:flex;gap:8px')}>
      <Button icon="download" disabled={exporting} onClick={() => pull('csv')}>CSV</Button>
      <Button variant="primary" icon="download" disabled={exporting} onClick={() => pull('xlsx')}>{exporting ? 'Building…' : 'Export report pack'}</Button>
    </div>
  );
}

export default function OverviewTab({ range, setRange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getReports(rangeWindow(range))
      .then((d) => { if (active) setData(d); })
      .catch(() => { if (active) setData(null); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [range]);

  const stats = useMemo(() => {
    const su = data?.summary ?? {};
    const loc = data?.location ?? {};
    return [
      { label: 'Attendance', value: `${su.attendance_pct ?? 0}%`, tone: 'ok', icon: 'check' },
      { label: 'On-time rate', value: `${su.on_time_pct ?? 0}%`, tone: 'primary', icon: 'clock' },
      { label: 'On-site clock-ins', value: `${loc.on_site ?? 0}/${loc.clock_ins ?? 0}`, tone: loc.needs_review ? 'magenta' : 'ok', icon: 'location' },
      { label: 'Unresolved', value: su.unresolved ?? 0, tone: (su.unresolved ?? 0) > 0 ? 'danger' : 'ok', icon: 'alert' },
      { label: 'Verified hours', value: `${su.verified_hours ?? 0}h`, tone: 'info', icon: 'wallet' },
      { label: 'Care tasks done', value: `${su.tasks_pct ?? 0}%`, tone: (su.tasks_pct ?? 100) < 90 ? 'magenta' : 'ok', icon: 'check' },
    ];
  }, [data]);

  const punctuality = (data?.attendance_by_day ?? []).map((d) => {
    const t = d.on_time + d.late + d.missed;
    return { label: d.label, value: t ? Math.round((d.on_time / t) * 100) : 100 };
  });
  const attendance = (data?.attendance_by_day ?? []).map((d) => ({ label: d.label, segments: [{ value: d.on_time, color: CHART.ok }, { value: d.late, color: CHART.warn }, { value: d.missed, color: CHART.danger }] }));
  const severity = (data?.alerts_by_severity ?? []).map((x) => ({ label: SEV_LABEL[x.severity] ?? x.severity, value: x.count, color: SEV_COLOR[x.severity] ?? CHART.primary }));
  // Backend returns the full sorted lists (so exports are complete); cap here for the charts.
  const hoursByCarer = (data?.hours_by_carer ?? []).slice(0, 8).map((x) => ({ label: x.name.split(' ')[0], value: x.hours, color: CHART.primary }));
  const exceptionsByDay = (data?.exceptions_by_day ?? []).map((x) => ({ label: x.label, value: x.count }));
  const lateByClient = (data?.late_by_client ?? []).slice(0, 6);
  const coverByClient = (data?.cover_by_client ?? []).slice(0, 6);
  const requestsByKind = (data?.requests?.by_kind ?? []).map((k) => ({ label: k.kind, value: k.count, color: CHART.primary }));
  const requestsByCarer = (data?.requests_by_carer ?? []).slice(0, 6);
  const carerReliability = data?.carer_reliability ?? [];
  const tasksByDay = (data?.tasks_by_day ?? []).map((d) => ({ label: d.label, value: d.pct }));
  const careByClient = (data?.care_by_client ?? []).slice(0, 6);
  const careByCarer = (data?.care_by_carer ?? []).slice(0, 6);

  if (loading && !data) return <Spinner fullscreen />;

  return (
    <div style={s('display:flex;flex-direction:column;gap:16px')}>
      {/* Hero band */}
      <Panel hero style={{ padding: '22px 24px' }}>
        <div style={s('display:flex;align-items:center;gap:16px;flex-wrap:wrap')}>
          <div style={s('flex:1;min-width:0')}>
            <div style={s('font-size:20px;font-weight:700;color:var(--d-primary-deep);letter-spacing:-0.3px')}>How clocking performed this period</div>
            <div style={s('font-size:13px;font-weight:500;color:var(--d-ink2);margin-top:3px')}>Attendance, punctuality and exceptions across every care visit — from real clock records.</div>
          </div>
        </div>
      </Panel>

      {/* Range selector — normal tabs */}
      <SegTabs active={range} onSelect={setRange} tabs={RANGES.map((r) => ({ key: r.id, label: r.label }))} />

      {/* Stat tiles */}
      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
        {stats.map((st) => (
          <Panel key={st.label} style={{ padding: '18px 20px' }}>
            <div style={{ ...s('width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:12px'), background: `var(--d-${st.tone === 'ok' ? 'ok' : st.tone === 'primary' ? 'primary-soft' : st.tone === 'magenta' ? 'primary-soft' : 'info'}-bg)`, color: `var(--d-${st.tone === 'magenta' ? 'magenta' : st.tone === 'primary' ? 'primary-deep' : st.tone === 'ok' ? 'ok-ink' : 'info-ink'})` }}><Icon name={st.icon} size={18} /></div>
            <div className="d-num" style={s('font-size:30px;font-weight:700;color:var(--d-ink);line-height:1')}>{st.value}</div>
            <div style={s('font-size:12.5px;font-weight:600;color:var(--d-ink);margin-top:6px')}>{st.label}</div>
            <div style={s('font-size:11px;font-weight:500;color:var(--d-muted);margin-top:1px')}>this period</div>
          </Panel>
        ))}
      </div>

      {/* Charts */}
      <div style={s('display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px;align-items:start')}>
        <Panel>
          <PanelTitle hint="On-time rate per day across the range">Attendance &amp; punctuality</PanelTitle>
          {punctuality.length ? <LineChart series={punctuality} /> : <Empty />}
        </Panel>
        <Panel>
          <PanelTitle hint="Open and historic alerts by severity">Alerts by severity</PanelTitle>
          {severity.length ? <DonutChart segments={severity} /> : <Empty />}
        </Panel>
      </div>

      <div style={s('display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:start')}>
        <Panel>
          <PanelTitle hint="Shifts by outcome, per day">Attendance trend</PanelTitle>
          {attendance.length ? <StackedBars data={attendance} /> : <Empty />}
          <div style={s('display:flex;gap:14px;margin-top:12px')}>
            {[['On time', CHART.ok], ['Late', CHART.warn], ['Missed', CHART.danger]].map(([l, c]) => (
              <div key={l} style={s('display:flex;align-items:center;gap:6px')}><span style={{ ...s('width:9px;height:9px;border-radius:3px'), background: c }} /><span style={s('font-size:11.5px;font-weight:600;color:var(--d-muted)')}>{l}</span></div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelTitle hint="Verified hours per carer (top 8)">Hours by carer</PanelTitle>
          {hoursByCarer.length ? <BarChart data={hoursByCarer} unit="h" /> : <Empty />}
        </Panel>
        <Panel>
          <PanelTitle hint="Alerts raised per day">Exception volume</PanelTitle>
          {exceptionsByDay.length ? <BarChart data={exceptionsByDay} /> : <Empty />}
        </Panel>
      </div>

      <Panel padded={false} style={{ padding: '20px 22px' }}>
        <PanelTitle hint="Geofence result at clock-in — the location integrity of every arrival">Location at clock-in</PanelTitle>
        {(() => {
          const loc = data?.location ?? {};
          const items = [
            ['On site', loc.on_site ?? 0, 'ok'],
            ['Out of range', loc.out_of_range ?? 0, 'danger'],
            ['No GPS fix', loc.no_gps_fix ?? 0, 'warning'],
            ['Not checked', loc.not_checked ?? 0, 'muted'],
          ];
          if (!loc.clock_ins) return <Empty label="No clock-ins in this period." />;
          return (
            <div style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:10px')}>
              {items.map(([label, value, tone]) => (
                <div key={label} style={s('background:var(--d-panel);border-radius:14px;padding:14px;text-align:center')}>
                  <div className="d-num" style={s('font-size:20px;font-weight:700;color:var(--d-ink)')}>{value}</div>
                  <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-top:3px')}>{label}</div>
                  <div style={s('margin-top:6px')}><Tag tone={value > 0 ? tone : 'muted'}>{loc.clock_ins ? Math.round((value / loc.clock_ins) * 100) : 0}%</Tag></div>
                </div>
              ))}
            </div>
          );
        })()}
      </Panel>

      <Panel padded={false} style={{ padding: '20px 22px' }}>
        <PanelTitle hint="Where lateness clusters — by person">Late arrivals by client</PanelTitle>
        {lateByClient.length === 0 ? <Empty label="No late arrivals in this period." /> : (
          <TableWrap minWidth={480}>
            <thead><tr><Th>Client</Th><Th align="right">Visits</Th><Th align="right">Late</Th><Th align="right">Rate</Th></tr></thead>
            <tbody>
              {lateByClient.map((h) => (
                <Row key={h.client}>
                  <Td>{h.client}</Td>
                  <Td align="right" mono>{h.visits}</Td>
                  <Td align="right" mono>{h.late}</Td>
                  <Td align="right"><Tag tone={h.late / h.visits > 0.15 ? 'warning' : 'muted'}>{Math.round((h.late / h.visits) * 100)}%</Tag></Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel padded={false} style={{ padding: '20px 22px' }}>
        <PanelTitle hint="How much of the period needed the cover board, and how quickly it got filled">Staffing &amp; cover health</PanelTitle>
        {(() => {
          const st = data?.staffing ?? {};
          if (!st.total_visits) return <Empty label="No published visits in this period." />;
          const items = [
            ['Needed cover', st.needed_cover ?? 0, st.cover_rate_pct != null ? `${st.cover_rate_pct}%` : null, 'warning'],
            ['Filled', st.filled ?? 0, st.fill_rate_pct != null ? `${st.fill_rate_pct}%` : null, 'success'],
            ['Still unfilled', st.still_unfilled ?? 0, null, 'danger'],
            ['Avg time to fill', st.avg_time_to_fill_min != null ? `${st.avg_time_to_fill_min}m` : '—', null, 'muted'],
          ];
          return (
            <div style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:10px')}>
              {items.map(([label, value, pct, tone]) => (
                <div key={label} style={s('background:var(--d-panel);border-radius:14px;padding:14px;text-align:center')}>
                  <div className="d-num" style={s('font-size:20px;font-weight:700;color:var(--d-ink)')}>{value}</div>
                  <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-top:3px')}>{label}</div>
                  {pct != null && <div style={s('margin-top:6px')}><Tag tone={tone}>{pct}</Tag></div>}
                </div>
              ))}
            </div>
          );
        })()}
      </Panel>

      {coverByClient.length > 0 && (
        <Panel padded={false} style={{ padding: '20px 22px' }}>
          <PanelTitle hint="Clients whose visits most often needed the cover board">Cover needed by client</PanelTitle>
          <TableWrap minWidth={420}>
            <thead><tr><Th>Client</Th><Th align="right">Visits needing cover</Th><Th align="right">Still unfilled</Th></tr></thead>
            <tbody>
              {coverByClient.map((c) => (
                <Row key={c.client}>
                  <Td>{c.client}</Td>
                  <Td align="right" mono>{c.visits}</Td>
                  <Td align="right" mono>{c.unfilled > 0 ? <Tag tone="danger">{c.unfilled}</Tag> : <span style={s('color:var(--d-faint)')}>0</span>}</Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}

      <div style={s('display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px;align-items:start')}>
        <Panel padded={false} style={{ padding: '20px 22px' }}>
          <PanelTitle hint="Swaps, drops, overtime, availability changes and leave — how responsive the office is">Requests &amp; leave</PanelTitle>
          {(() => {
            const rq = data?.requests ?? {};
            if (!rq.total) return <Empty label="No requests raised in this period." />;
            const items = [
              ['Raised', rq.total ?? 0, null, 'muted'],
              ['Pending', rq.pending ?? 0, null, 'warning'],
              ['Approved', rq.approved ?? 0, `${rq.approval_rate_pct ?? 0}%`, 'success'],
              ['Avg turnaround', rq.avg_turnaround_hours != null ? `${rq.avg_turnaround_hours}h` : '—', null, 'muted'],
            ];
            return (
              <div style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px')}>
                {items.map(([label, value, pct, tone]) => (
                  <div key={label} style={s('background:var(--d-panel);border-radius:14px;padding:14px;text-align:center')}>
                    <div className="d-num" style={s('font-size:20px;font-weight:700;color:var(--d-ink)')}>{value}</div>
                    <div style={s('font-size:11px;font-weight:600;color:var(--d-muted);margin-top:3px')}>{label}</div>
                    {pct != null && <div style={s('margin-top:6px')}><Tag tone={tone}>{pct}</Tag></div>}
                  </div>
                ))}
              </div>
            );
          })()}
          {requestsByKind.length ? <BarChart data={requestsByKind} /> : null}
        </Panel>

        <Panel>
          <PanelTitle hint="Who's raising the most swap/drop/overtime/leave requests">Requests by carer</PanelTitle>
          {requestsByCarer.length === 0 ? <Empty /> : (
            <div style={s('display:flex;flex-direction:column;gap:9px')}>
              {requestsByCarer.map((r) => (
                <div key={r.carer} style={s('display:flex;align-items:center;justify-content:space-between;background:var(--d-panel);border-radius:12px;padding:10px 13px')}>
                  <span style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{r.carer}</span>
                  <span style={s('display:flex;align-items:center;gap:8px')}>
                    {r.pending > 0 && <Tag tone="warning">{r.pending} pending</Tag>}
                    <span className="d-num" style={s('font-size:12.5px;font-weight:700;color:var(--d-ink)')}>{r.total}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel padded={false} style={{ padding: '20px 22px' }}>
        <PanelTitle hint="On-time rate per carer, worst first — who most needs a conversation">Carer reliability</PanelTitle>
        {carerReliability.length === 0 ? <Empty label="No visits in this period." /> : (
          <TableWrap minWidth={560}>
            <thead><tr><Th>Carer</Th><Th align="right">Visits</Th><Th align="right">On time</Th><Th align="right">Late</Th><Th align="right">Missed</Th><Th align="right">On-time rate</Th></tr></thead>
            <tbody>
              {carerReliability.map((c) => (
                <Row key={c.carer}>
                  <Td><b style={s('font-weight:700;color:var(--d-ink)')}>{c.carer}</b></Td>
                  <Td align="right" mono>{c.visits}</Td>
                  <Td align="right" mono>{c.on_time}</Td>
                  <Td align="right" mono>{c.late > 0 ? <span style={s('color:var(--d-warn-ink)')}>{c.late}</span> : c.late}</Td>
                  <Td align="right" mono>{c.missed > 0 ? <span style={s('color:var(--d-danger-ink)')}>{c.missed}</span> : c.missed}</Td>
                  <Td align="right"><Tag tone={c.on_time_pct >= 90 ? 'success' : c.on_time_pct >= 75 ? 'warning' : 'danger'}>{c.on_time_pct}%</Tag></Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <div style={s('display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px;align-items:start')}>
        <Panel>
          <PanelTitle hint="Care-task completion rate per day across the range">Task completion trend</PanelTitle>
          {tasksByDay.length ? <LineChart series={tasksByDay} /> : <Empty />}
        </Panel>
        <Panel>
          <PanelTitle hint="Tasks recorded, done, and how many visits got a written note">Care delivery this period</PanelTitle>
          {(() => {
            const cd = data?.care_delivery ?? {};
            if (!cd.tasks_total && !cd.notes_recorded) return <Empty label="No care tasks or notes in this period." />;
            const items = [
              ['Tasks done', `${cd.tasks_done ?? 0}/${cd.tasks_total ?? 0}`, `${cd.tasks_pct ?? 100}%`],
              ['Notes recorded', cd.notes_recorded ?? 0, null],
              ['Visits with a note', cd.visits_with_notes ?? 0, null],
            ];
            return (
              <div style={s('display:flex;flex-direction:column;gap:10px')}>
                {items.map(([label, value, pct]) => (
                  <div key={label} style={s('display:flex;align-items:center;justify-content:space-between;background:var(--d-panel);border-radius:12px;padding:11px 14px')}>
                    <span style={s('font-size:12.5px;font-weight:600;color:var(--d-muted)')}>{label}</span>
                    <span style={s('display:flex;align-items:center;gap:8px')}>
                      <span className="d-num" style={s('font-size:14px;font-weight:700;color:var(--d-ink)')}>{value}</span>
                      {pct != null && <Tag tone={cd.tasks_pct >= 90 ? 'success' : cd.tasks_pct >= 70 ? 'warning' : 'danger'}>{pct}</Tag>}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </Panel>
      </div>

      {careByClient.length > 0 && (
        <Panel padded={false} style={{ padding: '20px 22px' }}>
          <PanelTitle hint="Task completion rate by client, worst first">Care delivery by client</PanelTitle>
          <TableWrap minWidth={420}>
            <thead><tr><Th>Client</Th><Th align="right">Tasks done</Th><Th align="right">Completion</Th></tr></thead>
            <tbody>
              {careByClient.map((c) => (
                <Row key={c.client}>
                  <Td>{c.client}</Td>
                  <Td align="right" mono>{c.tasks_done}/{c.tasks_total}</Td>
                  <Td align="right"><Tag tone={c.tasks_pct >= 90 ? 'success' : c.tasks_pct >= 70 ? 'warning' : 'danger'}>{c.tasks_pct}%</Tag></Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}

      {careByCarer.length > 0 && (
        <Panel padded={false} style={{ padding: '20px 22px' }}>
          <PanelTitle hint="Task completion rate by carer, worst first">Care delivery by carer</PanelTitle>
          <TableWrap minWidth={420}>
            <thead><tr><Th>Carer</Th><Th align="right">Tasks done</Th><Th align="right">Completion</Th></tr></thead>
            <tbody>
              {careByCarer.map((c) => (
                <Row key={c.carer}>
                  <Td>{c.carer}</Td>
                  <Td align="right" mono>{c.tasks_done}/{c.tasks_total}</Td>
                  <Td align="right"><Tag tone={c.tasks_pct >= 90 ? 'success' : c.tasks_pct >= 70 ? 'warning' : 'danger'}>{c.tasks_pct}%</Tag></Td>
                </Row>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}
    </div>
  );
}

function Empty({ label = 'No data in this period.' }) {
  return <div style={s('padding:34px 16px;text-align:center;font-size:12.5px;font-weight:500;color:var(--d-muted)')}>{label}</div>;
}
