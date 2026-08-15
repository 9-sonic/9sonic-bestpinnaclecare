import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listShifts } from '../api/shifts.js';
import { buildClockEvent, sendClockEvent, toggleBreak } from '../api/clock.js';
import { getBreak, clearBreak } from '../utils/breaks.js';
import { getCurrentLocation } from '../utils/geolocation.js';
import { formatElapsed, formatTime } from '../utils/format.js';
import Button from '../components/common/Button.jsx';
import Icon from '../components/common/Icon.jsx';
import Dial from '../components/clock/Dial.jsx';
import ShiftCard from '../components/shifts/ShiftCard.jsx';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Modal from '../components/common/Modal.jsx';
import AssistanceRequestDialog from '../components/clock/AssistanceRequestDialog.jsx';
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  // The last clock failure, kept so the assistance request can describe what
  // actually happened (error, distance, when, where) without the carer typing.
  const [lastError, setLastError] = useState(null);
  // Break state lives on the device, not on the shift. The API models
  // `break_minutes` but has no endpoint for starting or ending a break, so
  // nothing comes back from the server to merge into the shift — it has to be
  // read from local storage and held here. See utils/breaks.js.
  const [breakState, setBreakState] = useState({ totalMs: 0, startedAt: null });
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

  // Warm up location as soon as the clock screen opens, so the permission
  // prompt is handled and a fix is cached before the first tap — otherwise the
  // very first clock-in often goes out with no location.
  useEffect(() => {
    let active = true;
    getCurrentLocation().then((loc) => { if (active && loc) setGps(loc); }).catch(() => {});
    return () => { active = false; };
  }, []);

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

  // Secondary entry, e.g. from Help & support: /clock?assist=1 opens the
  // assistance form directly. The param is stripped so a reload or a shared
  // link does not keep reopening it.
  useEffect(() => {
    if (searchParams.get('assist') !== '1' || loading) return;
    setAssistOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('assist');
    setSearchParams(next, { replace: true });
  }, [searchParams, loading, setSearchParams]);

  // Load the stored break whenever the shown shift changes, so switching shifts
  // (or reloading mid-break) picks up where the carer left off. Keyed on the id
  // rather than the shift: `refresh()` hands back a new object every poll, and
  // depending on that would re-read storage — and stamp on a break just
  // toggled — several times a minute.
  const shiftId = shift?.id ?? null;
  useEffect(() => {
    setBreakState(shiftId ? getBreak(shiftId) : { totalMs: 0, startedAt: null });
  }, [shiftId]);

  const onBreak = !!breakState.startedAt;
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
    // `now` rather than Date.now(): the ticker is stopped during a break, so
    // using the frozen `now` on both sides is what holds the timer still.
    const runningBreak = breakState.startedAt
      ? now - new Date(breakState.startedAt).getTime()
      : 0;
    return Math.max(0, end - start - breakState.totalMs - runningBreak);
  }, [shift, breakState, now]);

  // Break time so far, including one currently running. Shown in the summary
  // strip, where it explains why the timer and the wall clock disagree.
  const breakLabel = useMemo(() => {
    if (!shift) return '---';
    const running = breakState.startedAt
      ? now - new Date(breakState.startedAt).getTime()
      : 0;
    const mins = Math.round((breakState.totalMs + running) / 60000);
    if (mins <= 0) return shift.clockInAt ? '0 min' : '---';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }, [shift, breakState, now]);

  // The lifecycle state, said once, in the chip under the header.
  const [statusTone, statusLabel] = useMemo(() => {
    if (!shift) return ['upcoming', 'No visit'];
    if (shift.status === 'completed') return ['done', 'Completed'];
    if (onBreak) return ['break', 'On break'];
    if (shift.status === 'active') return ['onshift', 'On shift'];
    return ['upcoming', 'Upcoming'];
  }, [shift, onBreak]);

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
        setLastError(null);
      } catch (err) {
        // Outside the geofence is a decision for the carer, not a failure to
        // retry, so it is surfaced rather than queued.
        if (err.code === 'too_far') {
          errorFeedback();
          const away = err.data?.distance_m;
          setLastError({ code: 'too_far', distanceM: away ?? null, attemptedAt: event.occurred_at, location });
          setError(
            away
              ? `You are about ${away}m from the address. Move closer and try again.`
              : err.message
          );
          return;
        }

        // Block mode, but we couldn't get a location — enable it and retry.
        if (err.code === 'location_required') {
          errorFeedback();
          setLastError({ code: 'location_required', distanceM: null, attemptedAt: event.occurred_at, location });
          setError('We couldn’t get your location. Turn on location for this app and try again.');
          return;
        }

        // The shift hasn't started yet — clocking in opens shortly before it.
        if (err.code === 'too_early') {
          errorFeedback();
          setLastError({ code: 'too_early', distanceM: null, attemptedAt: event.occurred_at, location });
          setError("This shift hasn't started yet. You can clock in shortly before it begins.");
          return;
        }

        if (!online || err.isNetworkError) {
          enqueue({ visitAssignmentId: shift.id, event });
          setLastError({ code: 'no_connection', distanceM: null, attemptedAt: event.occurred_at, location });
          warnFeedback();
          toast.warn('Saved on this phone. It will sync when you have signal.');
        } else {
          throw err;
        }
      }

      // The shift is over, so the device-local break record has nothing left to
      // measure. Clearing it stops a stale break leaking into a later visit
      // that happens to reuse the id.
      if (kind === 'clock_out') {
        clearBreak(shift.id);
        setBreakState({ totalMs: 0, startedAt: null });
      }

      await refresh();
    } catch (err) {
      errorFeedback();
      // Covers getCurrentLocation failing before an event was even built, and
      // anything rethrown above that was not a network drop.
      setLastError({
        code: err.code ?? null,
        distanceM: null,
        attemptedAt: new Date().toISOString(),
        location: gps,
      });
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
      // toggleBreak returns the updated record, so there is no need to read it
      // back. Resetting `now` at the same moment stops the timer jumping by up
      // to a second when the break starts or ends.
      const next = await toggleBreak({ shiftId: shift.id });
      setNow(Date.now());
      setBreakState(next);
    } catch (err) {
      toast.error(err.message || 'Could not update break');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="clockscreen">
      <ScreenHeader title="Clock In" />

      {/* Who the visit is for, with History opposite and the lifecycle state
          on its own line beneath. */}
      <div className="clockhead">
        <div
          className={`clockhead__who${shift ? ' clockhead__who--interactive' : ''}`}
          onClick={() => {
            if (shift) {
              tapFeedback();
              navigate(`/shifts/${shift.id}`);
            }
          }}
          role={shift ? 'button' : undefined}
          tabIndex={shift ? 0 : undefined}
          aria-label={shift ? `View visit details for ${shift.client}` : undefined}
          onKeyDown={(e) => {
            if (shift && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              tapFeedback();
              navigate(`/shifts/${shift.id}`);
            }
          }}
        >
          <div className="clockhead__who-text">
            <h2 className="clockhead__name">{shift ? shift.client : 'No visit selected'}</h2>
            {shift && <p className="clockhead__addr">{shift.address.split(',')[0]}</p>}
          </div>
          {shift && <Icon name="chevronRight" size={16} className="clockhead__chevron" />}
        </div>
        <Button
          variant="white"
          size="sm"
          className="btn--pill"
          onClick={() => navigate('/clock/history')}
        >
          History
        </Button>
      </div>

      {shift && (
        <div className="clockhead__state">
          <span className={`statuschip statuschip--${statusTone}`}>
            <span className="statuschip__dot" aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
      )}

      {!shift ? (
        <EmptyState icon="calendar" title="No shifts today" text="When your rota is published your visits will appear here." />
      ) : (
        <>
          {/* Where the location stands. Before clocking in this says what will
              be recorded rather than implying the carer is being tracked. */}
          <span className={`verifychip${gps ? ' verifychip--ok' : ''}`}>
            <Icon name={gps ? 'check' : 'target'} size={13} />
            {gps
              ? `Verified · ${shift.address.split(',')[0]}`
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
          </Dial>

          {/* A paused timer looks identical to a stopped one, so it says so. */}
          {onBreak && (
            <p className="clock-note">
              On break since {formatTime(breakState.startedAt)} — time is paused
            </p>
          )}

          {error && <p className="error-text clock-error">{error}</p>}

          <div className="clock-actions">
            {shift.status === 'upcoming' && (
              <>
                <Button
                  size="lg"
                  className="btn--pill clock-actions__primary"
                  onClick={handleClockIn}
                  disabled={busy}
                >
                  <Icon name="clock" size={18} />
                  {busy ? 'Getting your location' : 'Clock In'}
                </Button>
                <button
                  type="button"
                  className="text-btn clock-actions__help"
                  onClick={() => setHelpOpen(true)}
                >
                  Can&apos;t clock in?
                </button>
              </>
            )}

            {isActive && (
              <div className="clock-actions__pair">
                <Button
                  variant={onBreak ? 'primary' : 'secondary'}
                  size="lg"
                  className="btn--pill"
                  onClick={handleBreak}
                  disabled={busy}
                >
                  <Icon name={onBreak ? 'play' : 'coffee'} size={18} filled={onBreak} />
                  {onBreak ? 'Resume Shift' : 'Take a Break'}
                </Button>
                <Button
                  variant="danger"
                  size="lg"
                  className="btn--pill"
                  onClick={handleClockOut}
                  disabled={busy}
                >
                  <span className="clock-stop" aria-hidden="true" />
                  Clock Out
                </Button>
              </div>
            )}

            {shift.status === 'completed' && (
              <Button variant="secondary" size="lg" className="btn--pill" block onClick={() => navigate('/shifts')}>
                View shifts
              </Button>
            )}
          </div>

          {/* The three figures a carer checks mid-visit. These used to be
              crowded into the dial face, where they competed with the timer. */}
          <div className="clockstats">
            <div className="clockstat">
              <span className="clockstat__label">Started</span>
              <span className="clockstat__value">
                {shift.clockInAt ? formatTime(shift.clockInAt) : '---'}
              </span>
            </div>
            <div className="clockstat">
              <span className="clockstat__label">Break</span>
              <span className="clockstat__value">{breakLabel}</span>
            </div>
            <div className="clockstat">
              <span className="clockstat__label">Est. end</span>
              <span className="clockstat__value clockstat__value--accent">
                {formatTime(shift.endsAt)}
              </span>
            </div>
          </div>

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
                    onSelect={(picked) => {
                      tapFeedback();
                      navigate(`/shifts/${picked.id}`);
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* What to do when the tap will not go through. Written so a carer can
          act on it standing at a front door, and honest that the record is
          kept either way. Location rules are not settled with the client, so
          this describes what the app does, not what policy requires. */}
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Can't clock in?"
        footer={
          // The form opens ON TOP of this advice sheet, not in its place:
          // closing a Modal unwinds its history entry with a deferred
          // history.back(), which would pop the new dialog's entry and close
          // it instantly. Nested overlays each push their own entry and unwind
          // one at a time (see useHistoryOverlay).
          <Button
            pill
            block
            onClick={() => {
              tapFeedback();
              setAssistOpen(true);
            }}
          >
            Request help from the office
          </Button>
        }
      >
        <div className="prose">
          <p>
            <strong>No signal.</strong> Tap Clock In anyway. The time of your tap is
            saved on this phone and sent as soon as you have signal, so you are
            recorded as clocking in when you actually did.
          </p>
          <p>
            <strong>It says you are too far away.</strong> Move closer to the address
            and try again. If you are at the right place and it still refuses, clock
            in anyway and message the office so they can correct the record.
          </p>
          <p>
            <strong>Location is switched off.</strong> Turn it on in your phone
            settings. Location is only read at the moment you clock in or out, never
            in between.
          </p>
          <p>
            <strong>Still stuck.</strong> Message the office. Nothing is lost by
            trying, and a correction keeps the original record with it.
          </p>
        </div>
      </Modal>

      <AssistanceRequestDialog
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        shift={shift}
        errorContext={lastError}
        // Sent or queued: the whole episode is over, so close the advice
        // sheet sitting underneath as well.
        onSubmitted={() => setHelpOpen(false)}
      />
    </div>
  );
}
