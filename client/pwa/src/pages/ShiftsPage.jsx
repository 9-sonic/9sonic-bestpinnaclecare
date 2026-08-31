import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listShifts } from '../api/shifts.js';
import { useShiftUpdates } from '../hooks/useShiftUpdates.js';
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

  // Refetch the carer's shifts. Runs on mount, and again live whenever the
  // office changes their rota (see useShiftUpdates) so the calendar stays current
  // without the carer reopening the app.
  const load = useCallback(() => {
    listShifts()
      .then(setShifts)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useShiftUpdates(load);

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
        // The three tones are the three the legend names, and nothing else.
        // Taken from the real lifecycle state rather than the collapsed UI
        // status, which cannot tell a missed visit from a finished one. The
        // previous mapping coloured every completed visit amber, so a good
        // month looked like a month of late arrivals.
        markedDates={shifts.map((s) => ({
          date: s.startsAt,
          tone:
            s.lifecycleState === 'missed'
              ? 'missed'
              : s.lifecycleState === 'late' || s.lifecycleState === 'overdue'
                ? 'late'
                : 'care',
        }))}
      />

      {loading ? (
        <SkeletonList count={3} />
      ) : (
        <>
          <div className="section-head section-head--inset">
            <span className="section-head__title">Upcoming</span>
            <button type="button" className="section-head__link" onClick={() => navigate('/overview')}>
              See All
            </button>
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
