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
import { formatTimeRange, formatDayLabel } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  active: 'On shift',
  completed: 'Completed',
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
      await saveVisitNote({ shiftId, note, tasks });
      toast.success('Visit note saved');
    } catch {
      toast.error('Could not save note');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestCover() {
    tapFeedback();
    setSubmittingCover(true);
    try {
      setShift((prev) => ({ ...prev, status: 'cover_requested' }));
      setShowCoverModal(false);
      toast.success('Cover requested. The office has been notified.');
    } catch {
      toast.error('Could not request cover');
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
          {shift.address && (
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
          )}

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
          ) : (
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
          )}
          <Button
            size="sm"
            pill
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
