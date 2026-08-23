import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Modal from '../components/common/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getShift, saveVisitNote } from '../api/shifts.js';
import { createRequest } from '../api/requests.js';
import { enqueue as enqueueRequest } from '../utils/assistanceQueue.js';
import { useOnline } from '../hooks/useOnline.js';
import { newUuid } from '../utils/ids.js';
import { formatTimeRange, formatDayLabel } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  active: 'On shift',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
  cover_requested: 'Cover requested',
};

const COVER_REASONS = [
  { id: 'sick', label: '🤒 Unwell / Sick' },
  { id: 'emergency', label: '🚨 Family emergency' },
  { id: 'transport', label: '🚗 Transport issue' },
  { id: 'overlap', label: '⏱️ Schedule clash' },
  { id: 'other', label: '📝 Other reason' },
];

export default function ShiftDetailPage() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const [shift, setShift] = useState(null);
  const [note, setNote] = useState('');
  const [tasks, setTasks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverReason, setCoverReason] = useState('sick');
  const [coverNote, setCoverNote] = useState('');
  const [submittingCover, setSubmittingCover] = useState(false);

  useEffect(() => {
    let active = true;
    getShift(shiftId).then((s) => {
      if (!active) return;
      setShift(s);
      setTasks(s.tasks ?? []);
      setNote(s.visitNote ?? '');
    });
    return () => {
      active = false;
    };
  }, [shiftId]);

  const toggleTask = (id) => {
    tapFeedback();
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  async function handleSaveNote() {
    tapFeedback();
    setSaving(true);
    try {
      // `savedNote` is what the server already holds, so an unchanged note is
      // not posted again. Without it, tapping Save twice appends a duplicate.
      const { synced } = await saveVisitNote({
        shiftId,
        note,
        tasks,
        savedNote: shift?.visitNote ?? '',
      });
      if (synced) {
        setShift((prev) => ({ ...prev, visitNote: note, hasUnsentLocalEdits: false }));
        toast.success('Visit note saved');
      } else {
        setShift((prev) => ({ ...prev, hasUnsentLocalEdits: true }));
        toast.warn('Saved on this phone. It will be sent when you have signal.');
      }
    } catch {
      toast.error('Could not save note');
    } finally {
      setSaving(false);
    }
  }

  // Declining a visit is a carer request of kind `drop`: the carer is handing
  // the visit back and the office arranges cover. `drop` is one of the kinds the
  // backend actually accepts (CarerRequest::KINDS); the chosen reason travels in
  // `payload` rather than in `kind`, so nothing here depends on a kind the API
  // would reject.
  //
  // The status only flips once the office has really been told. Before this the
  // handler set it locally and toasted "the office has been notified" without
  // making any call at all, so a carer could believe a visit was covered when
  // nobody knew about it.
  async function handleRequestCover() {
    tapFeedback();
    setSubmittingCover(true);

    const reasonLabel = COVER_REASONS.find((r) => r.id === coverReason)?.label ?? coverReason;
    // Built once, outside the try, so the offline replay sends the same
    // client_request_id and the office gets one request rather than two.
    const body = {
      kind: 'drop',
      summary: `Cover needed — ${reasonLabel.replace(/^\S+\s/, '')}${shift ? ` (${shift.client})` : ''}`,
      detail: coverNote.trim() || null,
      payload: {
        visit_assignment_id: shift?.id ?? null,
        reason: coverReason,
        requested_at: new Date().toISOString(),
        client_request_id: newUuid(),
      },
    };

    try {
      if (!online) throw Object.assign(new Error('offline'), { isNetworkError: true });
      await createRequest(body);
      setShift((prev) => ({ ...prev, status: 'cover_requested' }));
      setShowCoverModal(false);
      toast.success('Cover requested. The office has been notified.');
    } catch (err) {
      if (err?.isNetworkError || !online) {
        // No signal is normal between visits, so hold it and say so honestly
        // instead of claiming the office knows.
        enqueueRequest(body);
        setShift((prev) => ({ ...prev, status: 'cover_requested' }));
        setShowCoverModal(false);
        toast.warn('Saved on this phone. It will be sent when you have signal.');
      } else {
        // The server refused it. Keep the modal open with the reason still
        // selected so the carer can adjust, and leave the status alone.
        toast.error(err.message || 'Could not request cover. Try again.');
      }
    } finally {
      setSubmittingCover(false);
    }
  }

  if (!shift) return <Spinner fullscreen />;

  const claimed = new Set();
  const plan = [
    ...(shift.carePlan ?? []).map((item) => {
      const task = tasks.find((t) => String(t.carePlanItemId) === String(item.id));
      if (task) claimed.add(task.id);
      const tickable = item.category !== 'allergy';
      return {
        key: `plan-${item.id}`,
        label: item.label,
        detail: item.detail,
        category: item.category,
        task: tickable ? task : null,
      };
    }),
    ...tasks
      .filter((t) => !claimed.has(t.id))
      .map((t) => ({ key: `task-${t.id}`, label: t.label, detail: '', category: 'task', task: t })),
  ];

  const tickable = plan.filter((p) => p.task);
  const doneCount = tickable.filter((p) => p.task.done).length;
  const allDone = tickable.length > 0 && doneCount === tickable.length;

  // A finished visit is a record, not a thing to act on: clocking into it again
  // would open a second attendance story for a visit that already has one, and
  // routing to an address the carer has already been to and left is noise.
  // Visit notes stay editable — writing up what happened is normal after the
  // fact, and the note has its own audited save path.
  const isCompleted = shift.status === 'completed';
  // Terminal = nothing left to do on this visit: it's finished, was missed, or
  // was cancelled. Clocking in, routing to it, and declining it are all off for
  // these — you can only clock into a live visit, and you can't hand back one
  // that's already gone.
  const isTerminal = isCompleted || shift.status === 'missed' || shift.status === 'cancelled';

  return (
    <div className="page--flush">
      <ScreenHeader
        title="Visit details"
        back
        onBack={() => navigate(-1)}
        action={
          shift.clientPhone && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Call client"
              onClick={() => {
                tapFeedback();
                window.open(`tel:${shift.clientPhone}`);
              }}
            >
              <Icon name="phone" size={18} />
            </button>
          )
        }
      />

      {/* Main Hero Card */}
      <Card className="detail-hero">
        <div className="detail-hero__top">
          <Avatar name={shift.client} size={50} />
          <div className="detail-hero__intro grow">
            <h2 className="detail-hero__name">{shift.client}</h2>
            <div className="detail-hero__timing">
              <Icon name="clock" size={13} />
              <span>{formatTimeRange(shift.startsAt, shift.endsAt)}</span>
              <span className="vcard__dot" aria-hidden="true">•</span>
              <span>{formatDayLabel(shift.startsAt)}</span>
            </div>
          </div>
          <Badge tone={shift.status === 'cover_requested' ? 'warning' : shift.status}>
            {STATUS_LABEL[shift.status] ?? shift.status}
          </Badge>
        </div>

        {/* Structured Info Tiles */}
        <div className="detail-hero__tiles">
          {shift.address &&
            (isTerminal ? (
              // Still shown — where the visit was is part of the record — but
              // inert, with no chevron promising a route that is over.
              <div className="detail-hero__tile detail-hero__tile--static">
                <span className="tile-icon tile-icon--teal">
                  <Icon name="pin" size={15} />
                </span>
                <span className="detail-hero__tile-text">{shift.address}</span>
              </div>
            ) : (
              <button
                type="button"
                className="detail-hero__tile"
                onClick={() => {
                  tapFeedback();
                  navigate(`/navigate/${shift.id}`);
                }}
              >
                <span className="tile-icon tile-icon--teal">
                  <Icon name="pin" size={15} />
                </span>
                <span className="detail-hero__tile-text">{shift.address}</span>
                <Icon name="chevronRight" size={16} className="detail-hero__tile-chevron" />
              </button>
            ))}

          {shift.accessNotes && (
            <div className="detail-hero__access">
              <Icon name="lock" size={14} />
              <span>Access: {shift.accessNotes}</span>
            </div>
          )}

          {shift.note && (
            <div className="detail-hero__admin-note">
              <Icon name="info" size={14} />
              <span>Office note: {shift.note}</span>
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="detail-hero__actions">
          {shift.clientPhone && (
            <Button
              variant="white"
              size="sm"
              pill
              onClick={() => {
                tapFeedback();
                window.open(`tel:${shift.clientPhone}`);
              }}
            >
              <Icon name="phone" size={15} /> Call
            </Button>
          )}
          {shift.status === 'cover_requested' ? (
            <Button
              variant="white"
              size="sm"
              pill
              disabled
              className="btn--cover-pending"
            >
              <Icon name="clock" size={14} /> Cover requested
            </Button>
          ) : !isTerminal ? (
            <Button
              variant="white"
              size="sm"
              pill
              onClick={() => {
                tapFeedback();
                setShowCoverModal(true);
              }}
            >
              <Icon name="close" size={15} /> Decline
            </Button>
          ) : null}
          <Button
            size="sm"
            pill
            disabled={isTerminal}
            onClick={() => {
              tapFeedback();
              navigate(`/clock?shift=${shift.id}`);
            }}
          >
            <Icon name="clock" size={15} />
            {shift.status === 'active' ? 'Open timer' : 'Clock in'}
          </Button>
        </div>
      </Card>

      {/* Care Plan & Task Checklist */}
      {plan.length > 0 && (
        <>
          <div className="section-head section-head--inset">
            <span className="section-head__title">Care plan & tasks</span>
            {tickable.length > 0 && (
              <span className={`badge ${allDone ? 'badge--active' : 'badge--neutral'}`}>
                {doneCount}/{tickable.length} done
              </span>
            )}
          </div>
          <Card className="stack-card" padded={false}>
            {plan.map(({ key, label, detail, category, task }) =>
              task ? (
                <button
                  key={key}
                  type="button"
                  className={`task-row${task.done ? ' task-row--done' : ''}`}
                  onClick={() => toggleTask(task.id)}
                  aria-pressed={task.done}
                >
                  <span className="task-row__box">
                    {task.done && <Icon name="check" size={13} />}
                  </span>
                  <span className="task-row__body">
                    {category && category !== 'general' && category !== 'task' && (
                      <span className="task-row__category">{category}</span>
                    )}
                    <span className="task-row__label">{label}</span>
                    {detail && <span className="task-row__detail">{detail}</span>}
                  </span>
                </button>
              ) : (
                <div
                  key={key}
                  className={`task-row task-row--readonly${
                    category === 'allergy' ? ' task-row--flag' : ''
                  }`}
                >
                  <span className="task-row__box task-row__box--none" aria-hidden="true">
                    <Icon name={category === 'allergy' ? 'alert' : 'info'} size={15} />
                  </span>
                  <span className="task-row__body">
                    {category === 'allergy' && (
                      <span className="task-row__flag-tag">Allergy Alert</span>
                    )}
                    <span className="task-row__label">{label}</span>
                    {detail && <span className="task-row__detail">{detail}</span>}
                  </span>
                </div>
              )
            )}
          </Card>
        </>
      )}

      {/* Visit Notes Section */}
      <div className="section-head section-head--inset">
        <span className="section-head__title">Visit notes</span>
      </div>

      <Card className="notes-card" padded={true}>
        <textarea
          className="textarea notes-card__input"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Record what happened during this visit, meals, medication, mood, anything of concern..."
        />

        <Button pill onClick={handleSaveNote} disabled={saving} className="note-save">
          <Icon name="check" size={16} />
          {saving ? 'Saving…' : 'Save note'}
        </Button>
      </Card>

      {/* Request Shift Cover Modal */}
      <Modal
        open={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        title="Request shift cover"
        footer={
          <>
            <Button
              variant="white"
              pill
              onClick={() => setShowCoverModal(false)}
              disabled={submittingCover}
            >
              Cancel
            </Button>
            <Button
              pill
              loading={submittingCover}
              onClick={handleRequestCover}
            >
              Request cover
            </Button>
          </>
        }
      >
        <div className="cover-modal">
          <p className="cover-modal__lead">
            Decline visit with <strong>{shift.client}</strong> and notify the coordinator to arrange cover.
          </p>

          <label className="label">Reason for cover</label>
          <div className="cover-reasons">
            {COVER_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`cover-reason-chip${coverReason === r.id ? ' cover-reason-chip--active' : ''}`}
                onClick={() => {
                  tapFeedback();
                  setCoverReason(r.id);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="label" htmlFor="cover-note">Additional note (optional)</label>
          <textarea
            id="cover-note"
            className="textarea"
            rows={2}
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            placeholder="Brief reason or notes for the coordinator..."
          />
        </div>
      </Modal>
    </div>
  );
}
