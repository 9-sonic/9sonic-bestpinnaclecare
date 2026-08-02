import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import Modal from '../components/common/Modal.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { SkeletonList } from '../components/common/Skeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getTimesheet, raiseDispute } from '../api/stats.js';
import { formatDayLabel } from '../utils/format.js';

// What the carer worked, taken from the timesheet lines the office generates.
//
// No pay is shown. The API carries hours, not money: there are no pay rates and
// no mileage anywhere in the schema, so any figure here would be invented. That
// matters more than it looks, because a wrong number next to a pound sign is
// the kind of thing people plan their week around. Both gaps are written up in
// api_missing.md.

const FLAG_LABELS = {
  short: 'Under scheduled time',
  late_start: 'Late start',
  early_leave: 'Left early',
  no_clock_out: 'No clock out',
  manual: 'Adjusted by office',
  overtime: 'Over scheduled time',
};

function hoursFrom(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function TimesheetPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queryLine, setQueryLine] = useState(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getTimesheet()
      .then((d) => active && setData(d))
      .catch(() => active && setData({ entries: [], totalMinutes: 0, totalHours: 0 }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    if (!data) return null;
    const scheduled = data.entries.reduce((sum, e) => sum + (e.scheduledMinutes ?? 0), 0);
    const flagged = data.entries.filter((e) => (e.flags ?? []).length > 0).length;
    return { worked: data.totalMinutes, scheduled, flagged };
  }, [data]);

  async function handleRaise() {
    if (!reason.trim()) return;
    setSending(true);
    try {
      await raiseDispute({ timesheetLineId: queryLine.id, reason: reason.trim() });
      toast.success('Query sent to the office');
      setQueryLine(null);
      setReason('');
    } catch (err) {
      toast.error(err.message || 'Could not send that query');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page--flush">
      <ScreenHeader title="Timesheet" back onBack={() => navigate(-1)} />

      {loading || !data ? (
        <SkeletonList count={4} />
      ) : data.entries.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="Nothing recorded yet"
          text="Completed visits appear here once the office has processed them."
        />
      ) : (
        <>
          <Card className="pay-card">
            <span className="pay-card__label">Hours recorded this period</span>
            <span className="pay-card__value">{hoursFrom(totals.worked)}</span>
            <div className="pay-card__split">
              <span>
                <b>{data.entries.length}</b> {data.entries.length === 1 ? 'visit' : 'visits'}
              </span>
              <span>
                <b>{hoursFrom(totals.scheduled)}</b> scheduled
              </span>
            </div>
            <p className="pay-card__note">
              Your manager checks and approves these hours before they go to payroll.
            </p>
          </Card>

          <div className="section-head section-head--inset">
            <span className="section-head__title">Entries</span>
            {totals.flagged > 0 && (
              <Badge tone="upcoming">
                {totals.flagged} to check
              </Badge>
            )}
          </div>

          <div className="stack">
            {data.entries.map((e) => (
              <Card key={e.id} className="ts-row">
                <span className="ts-row__day">
                  <span className="ts-row__date">{formatDayLabel(e.workDate)}</span>
                  <span className="ts-row__client">
                    {(e.flags ?? []).length > 0
                      ? (e.flags ?? []).map((f) => FLAG_LABELS[f] ?? f).join(', ')
                      : 'As scheduled'}
                  </span>
                </span>
                <span className="ts-row__meta">
                  <span className="ts-row__time">{hoursFrom(e.workedMinutes ?? 0)}</span>
                  <button
                    type="button"
                    className="ts-row__query"
                    onClick={() => setQueryLine(e)}
                  >
                    Query
                  </button>
                </span>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!queryLine}
        onClose={() => setQueryLine(null)}
        title="Query these hours"
        footer={
          <>
            <Button variant="white" onClick={() => setQueryLine(null)}>
              Cancel
            </Button>
            <Button onClick={handleRaise} disabled={sending || !reason.trim()}>
              {sending ? 'Sending' : 'Send query'}
            </Button>
          </>
        }
      >
        <p className="modal__text">
          Tell the office what looks wrong with{' '}
          {queryLine ? formatDayLabel(queryLine.workDate) : 'this entry'}. Someone will check the
          original clock records and reply.
        </p>
        <label className="field">
          <span className="field__label">What is wrong?</span>
          <textarea
            className="textarea"
            rows={4}
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            placeholder="For example: I stayed until 3pm but this shows 2pm."
          />
        </label>
        <div className="readonly-note">
          <Icon name="info" size={15} />
          <span>
            Your original clock in and out are never changed. A correction is added alongside them
            with a note of who made it and why.
          </span>
        </div>
      </Modal>
    </div>
  );
}
