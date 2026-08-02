import { useCallback, useEffect, useState } from 'react';
import { getExceptions, acknowledgeAlert, resolveAlert, correctClock } from '../api/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_TONE,
  formatTime,
  formatTimeRange,
  formatDate,
  fullName,
} from '../api/format.js';

const ALERT_LABELS = {
  visit_late: 'Carer is late',
  no_clock_out: 'No clock out recorded',
  unassigned_visit: 'Visit has no carer',
  visit_missed: 'Visit missed',
  geofence_fail: 'Clocked in away from the address',
};

// Everything waiting on a person in the office: visits that need a decision,
// and alerts the system has raised.
//
// The correction dialog is the sensitive part. A manager can add a missing
// clock out, but the original record is never edited: the API appends a
// correction that points at the event it supersedes, and both are kept with a
// note of who did it and why. The dialog says so, because a manager typing a
// time needs to know it is going on the record under their name.
function CorrectionDialog({ open, onClose, assignment, onDone }) {
  const toast = useToast();
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!time || !reason.trim()) return;
    setBusy(true);
    try {
      const day = new Date(assignment.visit.scheduled_start);
      const [h, m] = time.split(':').map(Number);
      day.setHours(h, m, 0, 0);

      await correctClock({
        visit_assignment_id: assignment.id,
        kind: 'clock_out',
        occurred_at: day.toISOString(),
        reason: reason.trim(),
      });
      toast.success('Correction recorded against the original');
      onDone();
      onClose();
      setTime('');
      setReason('');
    } catch (err) {
      toast.error(err.message || 'Could not record that correction');
    } finally {
      setBusy(false);
    }
  }

  if (!assignment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a clock out"
      footer={
        <>
          <Button variant="white" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit} disabled={!time || !reason.trim()}>
            Record correction
          </Button>
        </>
      }
    >
      <div className="assign__visit">
        <span className="assign__who">{fullName(assignment.visit?.service_user)}</span>
        <span className="assign__when">
          Scheduled {formatTimeRange(assignment.visit?.scheduled_start, assignment.visit?.scheduled_end)}
        </span>
        <span className="assign__where">
          Clocked in {formatTime(assignment.actual_start)}, never clocked out
        </span>
      </div>

      <label className="field">
        <span className="field__label">Clock out time</span>
        <input
          className="field__input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Why is this being added?</span>
        <textarea
          className="textarea"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="For example: carer confirmed by phone they left at 19:05, phone battery died."
        />
      </label>

      <div className="note">
        <Icon name="shield" size={16} />
        <span>
          The carer&apos;s original record is not changed. This is added alongside it, recorded against
          your name, and both are kept in the audit history.
        </span>
      </div>
    </Modal>
  );
}

export default function ExceptionsPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [correcting, setCorrecting] = useState(null);

  const load = useCallback(async () => {
    const d = await getExceptions();
    setData(d);
  }, []);

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  async function ack(alert) {
    try {
      await acknowledgeAlert(alert.id);
      toast.info('Acknowledged');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function resolve(alert) {
    try {
      await resolveAlert(alert.id, 'Resolved from the exceptions queue');
      toast.success('Resolved');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) return <Spinner fullscreen />;

  const pending = data?.pending_review ?? [];
  const alerts = data?.open_alerts ?? [];
  const nothing = pending.length === 0 && alerts.length === 0;

  return (
    <>
      <PageHeader
        title="Exceptions"
        subtitle={
          nothing
            ? 'Nothing needs a decision right now'
            : `${pending.length} visits and ${alerts.length} alerts waiting`
        }
      />

      {nothing ? (
        <Card>
          <EmptyState
            icon="check"
            title="All clear"
            text="No visits are waiting for a decision and there are no open alerts."
          />
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="section">
              <div className="section__head">
                <h2 className="section__title">Visits needing a decision</h2>
              </div>
              <div className="stack">
                {pending.map((a) => (
                  <Card key={a.id} className="exc">
                    <div className="exc__main">
                      <div className="exc__head">
                        <Badge tone={LIFECYCLE_TONE[a.lifecycle_state]}>
                          {LIFECYCLE_LABELS[a.lifecycle_state]}
                        </Badge>
                        <span className="exc__date">{formatDate(a.visit?.scheduled_start)}</span>
                      </div>
                      <p className="exc__person">{fullName(a.visit?.service_user)}</p>
                      <p className="exc__detail">
                        Scheduled {formatTimeRange(a.visit?.scheduled_start, a.visit?.scheduled_end)}
                        {a.actual_start ? `, clocked in ${formatTime(a.actual_start)}` : ', never clocked in'}
                        {a.actual_start && !a.actual_end ? ', no clock out' : ''}
                      </p>
                      {(a.flags ?? []).length > 0 && (
                        <div className="exc__flags">
                          {a.flags.map((f) => (
                            <span key={f} className="flag">
                              {f.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="exc__actions">
                      {a.actual_start && !a.actual_end && (
                        <Button size="sm" onClick={() => setCorrecting(a)}>
                          Add clock out
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {alerts.length > 0 && (
            <section className="section">
              <div className="section__head">
                <h2 className="section__title">Open alerts</h2>
              </div>
              <Card padded={false}>
                {alerts.map((al) => (
                  <div key={al.id} className="alert-row">
                    <span
                      className={`alert-row__dot alert-row__dot--${al.severity === 'high' ? 'high' : 'normal'}`}
                    />
                    <span className="alert-row__body">
                      <span className="alert-row__title">
                        {ALERT_LABELS[al.alert_type] ?? al.alert_type.replace(/_/g, ' ')}
                      </span>
                      <span className="cell-sub">
                        Raised {formatTime(al.raised_at)}, {al.subject_type} {al.subject_id}
                      </span>
                    </span>
                    <div className="row-actions">
                      <Button size="sm" variant="white" onClick={() => ack(al)}>
                        Acknowledge
                      </Button>
                      <Button size="sm" onClick={() => resolve(al)}>
                        Resolve
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </>
      )}

      <CorrectionDialog
        open={!!correcting}
        onClose={() => setCorrecting(null)}
        assignment={correcting}
        onDone={load}
      />
    </>
  );
}
