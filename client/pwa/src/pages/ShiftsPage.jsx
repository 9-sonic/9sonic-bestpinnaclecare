import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listShifts } from '../api/shifts.js';
import Calendar from '../components/shifts/Calendar.jsx';
import ShiftCard from '../components/shifts/ShiftCard.jsx';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Icon from '../components/common/Icon.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { SkeletonList } from '../components/common/Skeleton.jsx';

export default function ShiftsPage() {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    listShifts()
      .then((data) => active && setShifts(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Only show shifts for the selected calendar day.
  const forDay = useMemo(
    () =>
      shifts.filter(
        (s) => new Date(s.startsAt).toDateString() === selected.toDateString()
      ),
    [shifts, selected]
  );

  const upcoming = forDay.filter((s) => s.status !== 'completed');
  const completed = forDay.filter((s) => s.status === 'completed');

  const openShift = (shift) => navigate(`/shifts/${shift.id}`);

  return (
    <div className="page--flush">
      <ScreenHeader
        title="Shifts"
        back
        onBack={() => navigate('/home')}
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label="Weekly overview"
            onClick={() => navigate('/overview')}
          >
            <Icon name="trend" size={19} />
          </button>
        }
      />

      <Calendar
        selected={selected}
        onSelect={setSelected}
        markedDates={shifts.map((s) => s.startsAt)}
      />

      {loading ? (
        <SkeletonList count={3} />
      ) : (
        <>
          <div className="section-head section-head--inset">
            <span className="section-head__title">Upcoming</span>
            <span className="section-head__count">{upcoming.length}</span>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No shifts this day"
              text="Pick another date on the calendar, or check back once your rota is published."
            />
          ) : (
            <div className="shift-list">
              {upcoming.map((s, i) => (
                <ShiftCard key={s.id} shift={s} index={i + 1} onSelect={openShift} />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <>
              <div className="section-head section-head--inset">
                <span className="section-head__title">Completed</span>
                <span className="section-head__count">{completed.length}</span>
              </div>
              <div className="shift-list">
                {completed.map((s, i) => (
                  <ShiftCard key={s.id} shift={s} index={i + 1} onSelect={openShift} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
