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

  const doneCount = tasks.filter((t) => t.done).length;

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

      {shift.carePlan?.length > 0 && (
        <>
          <div className="section-head section-head--inset">
            <span className="section-head__title">Care plan</span>
          </div>
          <Card className="stack-card">
            {shift.carePlan.map((item, i) => (
              <div key={i} className="plan-row">
                <span className="plan-row__icon">
                  <Icon name={item.icon ?? 'check'} size={15} />
                </span>
                <span>
                  <span className="plan-row__label">{item.label}</span>
                  {item.detail && <span className="plan-row__detail">{item.detail}</span>}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <div className="section-head section-head--inset">
            <span className="section-head__title">Tasks</span>
            <span className="section-head__link">
              {doneCount}/{tasks.length} done
            </span>
          </div>
          <Card className="stack-card">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`task-row${t.done ? ' task-row--done' : ''}`}
                onClick={() => toggleTask(t.id)}
                aria-pressed={t.done}
              >
                <span className="task-row__box">{t.done && <Icon name="check" size={13} />}</span>
                <span className="task-row__label">{t.label}</span>
              </button>
            ))}
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
