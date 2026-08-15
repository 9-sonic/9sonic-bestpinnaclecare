import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getShift, saveVisitNote } from '../api/shifts.js';
import { formatTimeRange, formatDayLabel } from '../utils/format.js';

const STATUS_LABEL = { upcoming: 'Upcoming', active: 'On shift', completed: 'Completed' };

// Everything the carer needs before and during a visit: who, where, what tasks,
// what to watch for, and where to record what happened.
export default function ShiftDetailPage() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [shift, setShift] = useState(null);
  const [note, setNote] = useState('');
  const [tasks, setTasks] = useState([]);
  const [saving, setSaving] = useState(false);

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

  const toggleTask = (id) =>
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  async function handleSaveNote() {
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

  if (!shift) return <Spinner fullscreen />;

  // Care plan and tasks are the same things twice: the API seeds one visit task
  // per active care plan item, copying its label, so every task points back at
  // the item it came from. Listed separately, a carer read the instruction in
  // one card and ticked it off in another. One list instead — the item's own
  // wording and detail, with its task's checkbox.
  //
  // An allergy is the exception: the API seeds a task for it like anything
  // else, but "Penicillin allergy" is a standing warning, not something a
  // carer completes. It shows as a flag with no checkbox.
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
    // Anything recorded straight against the visit rather than the care plan.
    ...tasks
      .filter((t) => !claimed.has(t.id))
      .map((t) => ({ key: `task-${t.id}`, label: t.label, detail: '', task: t })),
  ];

  // Counted over what can actually be ticked, so a flag never makes the visit
  // look permanently unfinished.
  const tickable = plan.filter((p) => p.task);
  const doneCount = tickable.filter((p) => p.task.done).length;

  return (
    <div className="page--flush">
      <ScreenHeader title="Visit details" back onBack={() => navigate(-1)} />

      <Card className="detail-hero">
        <div className="detail-hero__top">
          <Avatar name={shift.client} size={48} />
          <div className="grow">
            <div className="detail-hero__name">{shift.client}</div>
            <div className="detail-hero__meta">
              {formatDayLabel(shift.startsAt)} · {formatTimeRange(shift.startsAt, shift.endsAt)}
            </div>
          </div>
          <Badge tone={shift.status}>{STATUS_LABEL[shift.status]}</Badge>
        </div>

        <button
          type="button"
          className="detail-hero__addr"
          onClick={() => navigate(`/navigate/${shift.id}`)}
        >
          <Icon name="pin" size={15} />
          <span>{shift.address}</span>
          <Icon name="chevronRight" size={15} />
        </button>

        <div className="detail-hero__actions">
          <Button
            variant="white"
            size="sm"
            onClick={() => window.open(`tel:${shift.clientPhone ?? ''}`)}
          >
            <Icon name="phone" size={15} /> Call
          </Button>
          <Button size="sm" onClick={() => navigate(`/clock?shift=${shift.id}`)}>
            <Icon name="clock" size={15} />
            {shift.status === 'active' ? 'Open timer' : 'Clock in'}
          </Button>
        </div>
      </Card>

      {plan.length > 0 && (
        <>
          <div className="section-head section-head--inset">
            <span className="section-head__title">Care plan</span>
            {tickable.length > 0 && (
              <span className="section-head__link">
                {doneCount}/{tickable.length} done
              </span>
            )}
          </div>
          <Card className="stack-card">
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
                    <span className="task-row__label">{label}</span>
                    {detail && <span className="task-row__detail">{detail}</span>}
                  </span>
                </button>
              ) : (
                // Standing guidance rather than something to complete: an
                // allergy, or a care plan item the office added after this
                // visit's tasks were seeded. Read, not ticked.
                <div
                  key={key}
                  className={`task-row task-row--readonly${
                    category === 'allergy' ? ' task-row--flag' : ''
                  }`}
                >
                  <span className="task-row__box task-row__box--none" aria-hidden="true">
                    <Icon name={category === 'allergy' ? 'alert' : 'info'} size={14} />
                  </span>
                  <span className="task-row__body">
                    <span className="task-row__label">{label}</span>
                    {detail && <span className="task-row__detail">{detail}</span>}
                  </span>
                </div>
              )
            )}
          </Card>
        </>
      )}

      <div className="section-head section-head--inset">
        <span className="section-head__title">Visit notes</span>
      </div>
      <div className="inset">
        <textarea
          className="textarea"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Record what happened during this visit, meals, medication, mood, anything of concern."
        />
        <Button block onClick={handleSaveNote} disabled={saving} className="note-save">
          {saving ? 'Saving' : 'Save note'}
        </Button>
      </div>
    </div>
  );
}
