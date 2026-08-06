import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listShifts } from '../api/shifts.js';
import { buildClockEvent, sendClockEvent, toggleBreak } from '../api/clock.js';
import { getCurrentLocation } from '../utils/geolocation.js';
import { formatElapsed, formatTime } from '../utils/format.js';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';
import Dial from '../components/clock/Dial.jsx';
import ShiftCard from '../components/shifts/ShiftCard.jsx';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { enqueue } from '../utils/offlineQueue.js';
import { successFeedback, errorFeedback, warnFeedback, tapFeedback } from '../utils/haptics.js';

export default function ClockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gps, setGps] = useState(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef(null);

  const selectedId = searchParams.get('shift');

  const refresh = useCallback(async () => {
    const data = await listShifts();
    setShifts(data);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    refresh()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refresh]);

  // The shown shift is derived, not stored. The URL wins when it names a shift
  // that still exists; otherwise fall back to whatever the carer most likely
  // wants. Deriving it means arriving here without the query string, or having
  // the selected shift drop out of the list on refresh, still shows something
  // sensible instead of an empty screen.
  const shift = useMemo(() => {
    if (shifts.length === 0) return null;
    return (
      shifts.find((s) => s.id === selectedId) ??
      shifts.find((s) => s.status === 'active') ??
      shifts.find((s) => s.status === 'upcoming') ??
      shifts[0]
    );
  }, [shifts, selectedId]);

  // Keep the URL in step so the screen can be shared or reloaded.
  useEffect(() => {
    if (shift && shift.id !== selectedId) {
      setSearchParams({ shift: shift.id }, { replace: true });
    }
  }, [shift, selectedId, setSearchParams]);

  const onBreak = !!shift?.breakStartedAt;
  const isActive = shift?.status === 'active';

  // Tick once a second only while a shift is running (saves battery otherwise).
  useEffect(() => {
    if (!isActive || onBreak) {
      clearInterval(tickRef.current);
      return undefined;
    }
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, [isActive, onBreak]);

  // Elapsed time on shift, excluding any break time.
  const elapsedMs = useMemo(() => {
    if (!shift?.clockInAt) return 0;
    const start = new Date(shift.clockInAt).getTime();
    const end = shift.clockOutAt ? new Date(shift.clockOutAt).getTime() : now;
    const runningBreak = shift.breakStartedAt
      ? Date.now() - new Date(shift.breakStartedAt).getTime()
      : 0;
    return Math.max(0, end - start - (shift.breakMs ?? 0) - runningBreak);
  }, [shift, now]);

  // How long the visit is booked for, shown under the running total.
  const scheduledLabel = useMemo(() => {
    if (!shift) return '';
    const mins = Math.round((new Date(shift.endsAt) - new Date(shift.startsAt)) / 60000);
    if (!Number.isFinite(mins) || mins <= 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }, [shift]);

  // Progress around the dial = elapsed / scheduled duration.
  const progress = useMemo(() => {
    if (!shift) return 0;
    const planned = new Date(shift.endsAt) - new Date(shift.startsAt);
    return planned > 0 ? elapsedMs / planned : 0;
  }, [shift, elapsedMs]);

  // Clocking captures GPS, then sends the event.
  //
  // The event is built once, before anything is sent, and the same object is
  // used for the live attempt and for the offline queue. That matters: the
  // server identifies an event by its client_event_id, so reusing it means a
  // tap that fails online and syncs later is recognised as the same tap rather
  // than a second visit. The timestamp is the moment of the tap, not the moment
  // it reaches the server.
  async function runClockAction(kind) {
    setError('');
    setBusy(true);
    try {
      const location = await getCurrentLocation();
      setGps(location);

      const event = buildClockEvent({ kind, location });

      try {
        await sendClockEvent({ visitAssignmentId: shift.id, event });
        successFeedback();
        toast.success(kind === 'clock_in' ? 'Clocked in' : 'Clocked out');
      } catch (err) {
        // Outside the geofence is a decision for the carer, not a failure to
        // retry, so it is surfaced rather than queued.
        if (err.code === 'too_far') {
          errorFeedback();
          const away = err.data?.distance_m;
          setError(
            away
              ? `You are about ${away}m from the address. Move closer and try again.`
              : err.message
          );
          return;
        }

        if (!online || err.isNetworkError) {
          enqueue({ visitAssignmentId: shift.id, event });
          warnFeedback();
          toast.warn('Saved on this phone. It will sync when you have signal.');
        } else {
          throw err;
        }
      }

      await refresh();
    } catch (err) {
      errorFeedback();
      setError(err.message || 'Something went wrong');
      toast.error(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const handleClockIn = () => runClockAction('clock_in');
  const handleClockOut = () => runClockAction('clock_out');

  async function handleBreak() {
    tapFeedback();
    setBusy(true);
    try {
      await toggleBreak({ shiftId: shift.id });
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Could not update break');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="clockscreen">
      {/* Title and who the visit is for, with History opposite. */}
      <div className="clockscreen__head">
        <div className="grow">
          <h1 className="clockscreen__title">{isActive ? 'On Shift' : 'Clock In'}</h1>
          {shift && (
            <p className="clockscreen__where">
              {shift.client} · {shift.address.split(',')[0]}
            </p>
          )}
        </div>
        <Button variant="white" size="sm" className="btn--pill" onClick={() => navigate('/overview')}>
          History
        </Button>
      </div>

      {!shift ? (
        <EmptyState icon="calendar" title="No shifts today" text="When your rota is published your visits will appear here." />
      ) : (
        <>
          <span
            className={`gps-chip${gps ? ' gps-chip--ok' : ''}`}
          >
            <Icon name={gps ? 'location' : 'target'} size={13} />
            {gps
              ? `Location fixed to within ${Math.round(gps.accuracy)}m`
              : 'Location is recorded when you clock in'}
          </span>

          <Dial
            progress={shift.status === 'completed' ? 1 : isActive ? progress : 0}
            state={
              shift.status === 'completed'
                ? 'complete'
                : onBreak
                  ? 'break'
                  : isActive
                    ? 'running'
                    : 'idle'
            }
          >
            <span className="dial__time">
              {isActive || shift.status === 'completed' ? formatElapsed(elapsedMs) : '00:00:00'}
            </span>
            <span className="dial__state">
              {shift.status === 'completed'
                ? 'Complete'
                : onBreak
                  ? 'On break'
                  : isActive
                    ? 'On shift'
                    : 'Not started'}
            </span>
            {/* Before a shift starts the elapsed figure is meaningless, so the
                face shows when the visit is booked for instead. */}
            {shift.status === 'upcoming' ? (
              <span className="dial__window">
                <Icon name="clock" size={12} />
                {formatTime(shift.startsAt)} to {formatTime(shift.endsAt)}
              </span>
            ) : (
              <span className="dial__sub">
                {progress > 1.001 ? 'over ' : 'of '}
                {scheduledLabel}
              </span>
            )}
          </Dial>

          {error && <p className="error-text clock-error">{error}</p>}

          <div className="clock-actions">
            {isActive && (
              <>
                <Button variant="white" size="lg" onClick={handleClockOut} disabled={busy}>
                  <span className="clock-stop" aria-hidden="true" />
                  Clock out
                </Button>
                <Button size="lg" onClick={handleBreak} disabled={busy}>
                  <Icon name={onBreak ? 'play' : 'coffee'} size={18} />
                  {onBreak ? 'Resume' : 'Break'}
                </Button>
              </>
            )}

            {shift.status === 'completed' && (
              <Button variant="white" size="lg" block onClick={() => navigate('/shifts')}>
                View shifts
              </Button>
            )}
          </div>

          {shift.status === 'upcoming' && (
            <div>
              <button
                type="button"
                className="clock-power"
                onClick={handleClockIn}
                disabled={busy}
                aria-label="Clock in"
              >
                <Icon name="play" size={26} filled />
              </button>
              <span className="clock-power__label">
                {busy ? 'Getting your location' : 'Tap to clock in'}
              </span>
            </div>
          )}

          {/* Switcher for the rest of the day. Uses the shared card in its
              compact form rather than a local copy of the markup. */}
          {shifts.length > 1 && (
            <section className="clock-switcher">
              <div className="section-head">
                <span className="section-head__title">Today&apos;s shifts</span>
                <span className="section-head__count">{shifts.length}</span>
              </div>
              <div className="shift-list shift-list--flush">
                {shifts.map((s) => (
                  <ShiftCard
                    key={s.id}
                    shift={s}
                    compact
                    selected={s.id === shift.id}
                    onSelect={(picked) =>
                      setSearchParams({ shift: picked.id }, { replace: true })
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
