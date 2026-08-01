import { useEffect, useState } from 'react';
import {
  listTimesheetPeriods,
  getTimesheetPeriod,
  approvePeriod,
  lockPeriod,
  listDisputes,
  resolveDispute,
} from '../api/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import DataTable from '../components/common/DataTable.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fullName, minutesToHours, formatDate } from '../api/format.js';

const STATUS_TONE = { open: 'info', approved: 'success', locked: 'neutral' };

export default function TimesheetsPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load(periodId) {
    const [ps, ds] = await Promise.all([listTimesheetPeriods(), listDisputes()]);
    setPeriods(ps);
    setDisputes(ds);
    const target = periodId ?? selected?.id ?? ps[0]?.id;
    if (target) setSelected(await getTimesheetPeriod(target));
  }

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApprove() {
    setBusy(true);
    try {
      await approvePeriod(selected.id);
      toast.success('Period approved, ready for payroll');
      await load(selected.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLock() {
    setBusy(true);
    try {
      await lockPeriod(selected.id);
      toast.success('Period locked, no further changes');
      await load(selected.id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveDispute(d) {
    try {
      await resolveDispute(d.id, 'Checked against the original clock records');
      toast.success('Query resolved');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <Spinner fullscreen />;

  const lines = selected?.lines ?? [];
  const totalWorked = lines.reduce((s, l) => s + (l.worked_minutes ?? 0), 0);
  const totalScheduled = lines.reduce((s, l) => s + (l.scheduled_minutes ?? 0), 0);
  const flagged = lines.filter((l) => (l.flags ?? []).length > 0).length;
  const openDisputes = disputes.filter((d) => d.state === 'open');

  const columns = [
    { key: 'date', header: 'Date', width: '150px', render: (l) => formatDate(l.work_date) },
    { key: 'who', header: 'Carer', render: (l) => fullName(l.employee) },
    {
      key: 'sched',
      header: 'Scheduled',
      width: '110px',
      render: (l) => minutesToHours(l.scheduled_minutes),
    },
    {
      key: 'worked',
      header: 'Worked',
      width: '110px',
      render: (l) => <b>{minutesToHours(l.worked_minutes)}</b>,
    },
    {
      key: 'diff',
      header: 'Difference',
      width: '120px',
      render: (l) => {
        const d = (l.worked_minutes ?? 0) - (l.scheduled_minutes ?? 0);
        if (d === 0) return <span className="cell-sub">On time</span>;
        return (
          <span className={d > 0 ? 'diff diff--over' : 'diff diff--under'}>
            {d > 0 ? '+' : ''}
            {d}m
          </span>
        );
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (l) =>
        (l.flags ?? []).length === 0 ? (
          <span className="cell-sub">None</span>
        ) : (
          <div className="exc__flags">
            {l.flags.map((f) => (
              <span key={f} className="flag">
                {f.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Timesheets"
        subtitle={
          selected
            ? `${formatDate(selected.starts_on)} to ${formatDate(selected.ends_on)}`
            : 'No periods yet'
        }
        actions={
          canManage &&
          selected && (
            <div className="row-actions">
              {selected.status === 'open' && (
                <Button loading={busy} onClick={handleApprove}>
                  <Icon name="check" size={16} />
                  Approve period
                </Button>
              )}
              {selected.status === 'approved' && (
                <Button variant="white" loading={busy} onClick={handleLock}>
                  <Icon name="shield" size={16} />
                  Lock period
                </Button>
              )}
            </div>
          )
        }
      />

      <div className="filters">
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${selected?.id === p.id ? ' chip--on' : ''}`}
            onClick={async () => setSelected(await getTimesheetPeriod(p.id))}
          >
            {formatDate(p.starts_on)}
            {p.status !== 'open' ? ` (${p.status})` : ''}
          </button>
        ))}
      </div>

      {openDisputes.length > 0 && (
        <Card className="warn-card">
          <Icon name="alert" size={18} />
          <div style={{ flex: 1 }}>
            <p className="warn-card__title">
              {openDisputes.length} {openDisputes.length === 1 ? 'query' : 'queries'} from carers
            </p>
            {openDisputes.map((d) => (
              <div key={d.id} className="dispute">
                <span>
                  <b>{fullName(d.employee)}</b>: {d.reason}
                </span>
                <Button size="sm" variant="white" onClick={() => handleResolveDispute(d)}>
                  Mark resolved
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {selected && (
        <div className="tiles">
          <div className="tile">
            <span className="tile__value">{minutesToHours(totalWorked)}</span>
            <span className="tile__label">Total worked</span>
          </div>
          <div className="tile">
            <span className="tile__value">{minutesToHours(totalScheduled)}</span>
            <span className="tile__label">Total scheduled</span>
          </div>
          <div className={`tile${flagged ? ' tile--warn' : ''}`}>
            <span className="tile__value">{flagged}</span>
            <span className="tile__label">Lines flagged</span>
          </div>
          <div className="tile">
            <span className="tile__value">
              <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
            </span>
            <span className="tile__label">Status</span>
          </div>
        </div>
      )}

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={lines}
          empty={
            <EmptyState
              icon="wallet"
              title="Nothing in this period"
              text="Lines appear once visits in the period are completed."
            />
          }
        />
      </Card>

      <p className="page-note">
        Approving marks the hours as checked. Locking prevents further edits and is the point at
        which the period goes to payroll. Neither changes the underlying clock records.
      </p>
    </>
  );
}
