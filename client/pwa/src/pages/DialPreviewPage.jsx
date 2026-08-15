import { useCallback, useEffect, useRef, useState } from 'react';
import Dial from '../components/clock/Dial.jsx';
import { formatElapsed } from '../utils/format.js';
// Kept out of global.css so it is dropped along with the route: this page is
// lazy-loaded behind import.meta.env.DEV, and global.css ships whole.
import '../styles/dial-preview.css';

// ---------------------------------------------------------------------------
// A workbench for the clock dial. Development only — App.jsx does not mount
// this route in a production build, so it cannot ship by accident.
//
// It exists because the dial is almost impossible to judge on the real clock
// screen: a visit is booked for hours, so a minute after clocking in the arc is
// a couple of pixels long and every question about the design — does the
// cylinder read as round, does the glow trail, do the ticks light in time with
// the arc, does amber say "paused" clearly enough — is unanswerable without
// sitting there for an hour.
//
// So the same component is driven against a 15-second shift instead of a
// six-hour one. Nothing about the dial changes; only how fast `progress` moves.
// The break behaves exactly as it does on the real screen: the clock holds, and
// the time spent paused is banked and subtracted, so a shift interrupted twice
// still ends on 15 seconds of worked time.
// ---------------------------------------------------------------------------

const SHIFT_MS = 15_000; // the "booked" visit
const IDLE_TIMEOUT_MS = 5 * 60_000; // stop the loop if the tab is left open

export default function DialPreviewPage() {
  const [phase, setPhase] = useState('idle'); // idle | running | break | complete
  const [elapsed, setElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [cycles, setCycles] = useState(0);
  // Demo mode walks the states on its own — clock in, run, break, resume,
  // finish, start over — so the whole cycle can be watched without clicking
  // through it, and without waiting on the arc to be in the right place.
  const [demo, setDemo] = useState(false);

  // Where the running clock is measured from. Pausing does not stop time, it
  // pushes this forward by however long the pause lasted, which is the same
  // arithmetic ClockPage does with the banked break total.
  const originRef = useRef(0);
  const pausedAtRef = useRef(0);
  const openedAtRef = useRef(Date.now());
  const rafRef = useRef(0);
  // Whether this lap has already had its scripted break. Without it the demo
  // resumes, sees the clock still inside the "time to break" window, and breaks
  // again on the very next frame — the dial ping-pongs between running and
  // paused and never gets past a third of the way round.
  const brokeThisLapRef = useRef(false);

  useEffect(() => {
    if (phase !== 'running') return undefined;

    // rAF rather than a 1s interval: the point of this screen is to watch the
    // arc move, and at 15 seconds a whole ring the once-a-second steps of the
    // real screen would hide everything the easing is there to smooth.
    const frame = () => {
      // Left open and forgotten. Stop rather than spin a rAF loop all day.
      if (Date.now() - openedAtRef.current > IDLE_TIMEOUT_MS) {
        setTimedOut(true);
        setDemo(false);
        setPhase('idle');
        return;
      }

      const ms = Date.now() - originRef.current;
      if (ms >= SHIFT_MS) {
        setElapsed(SHIFT_MS);
        setPhase('complete');
        setCycles((n) => n + 1);
        return;
      }
      setElapsed(ms);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  const start = useCallback(() => {
    // A hand-driven run restarts the 5-minute budget; a demo lap does not, or
    // the loop would keep itself alive forever.
    if (!demo) openedAtRef.current = Date.now();
    brokeThisLapRef.current = false;
    originRef.current = Date.now();
    setElapsed(0);
    setTimedOut(false);
    setPhase('running');
  }, [demo]);

  const toggleBreak = useCallback(() => {
    setPhase((current) => {
      if (current === 'running') {
        pausedAtRef.current = Date.now();
        return 'break';
      }
      if (current === 'break') {
        // Bank the pause: the shift resumes where it stopped, not where the
        // wall clock has got to.
        originRef.current += Date.now() - pausedAtRef.current;
        return 'running';
      }
      return current;
    });
  }, []);

  function reset() {
    setPhase('idle');
    setElapsed(0);
    setTimedOut(false);
  }

  // The demo script. Each step waits for the phase it is watching for, so it
  // rides on the same state the buttons drive rather than running a second
  // clock of its own that could drift out of step with the dial.
  useEffect(() => {
    if (!demo) return undefined;

    const after = (ms, fn) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    };

    // Idle for a beat so the not-started dial is actually visible, then run.
    if (phase === 'idle' && !timedOut) return after(1600, start);
    // A third of the way round, pause once — far enough in that there is an arc
    // to see stop, and short of the point where it would finish anyway.
    if (phase === 'running' && !brokeThisLapRef.current && elapsed > SHIFT_MS / 3) {
      brokeThisLapRef.current = true;
      return after(0, toggleBreak);
    }
    if (phase === 'break') return after(2600, toggleBreak);
    if (phase === 'complete') return after(2200, start);

    return undefined;
  }, [demo, phase, elapsed, timedOut, start, toggleBreak]);

  const progress = elapsed / SHIFT_MS;
  const state = phase === 'idle' ? 'idle' : phase;
  const label =
    phase === 'complete'
      ? 'Complete'
      : phase === 'break'
        ? 'On break'
        : phase === 'running'
          ? 'On shift'
          : 'Not started';

  return (
    <div className="dialpreview">
      <p className="dialpreview__banner">
        Dial workbench — a 15-second shift. Development build only.
        {demo && <span className="dialpreview__live"> demo running</span>}
      </p>

      <Dial progress={progress} state={state}>
        <span className="dial__state">{label}</span>
        <span className="dial__time">{formatElapsed(elapsed)}</span>
      </Dial>

      <div className="dialpreview__actions">
        <button
          type="button"
          className={`btn btn--pill ${demo ? 'btn--danger' : 'btn--primary'}`}
          onClick={() => {
            if (!demo) {
              openedAtRef.current = Date.now();
              setTimedOut(false);
              reset();
            }
            setDemo((on) => !on);
          }}
        >
          {demo ? 'Stop demo' : 'Play demo'}
        </button>
      </div>

      <div className="dialpreview__actions">
        {(phase === 'idle' || phase === 'complete') && (
          <button type="button" className="btn btn--primary btn--pill" onClick={start}>
            {phase === 'complete' ? 'Run again' : 'Clock in'}
          </button>
        )}
        {(phase === 'running' || phase === 'break') && (
          <>
            <button type="button" className="btn btn--secondary btn--pill" onClick={toggleBreak}>
              {phase === 'break' ? 'Resume shift' : 'Take a break'}
            </button>
            <button type="button" className="btn btn--danger btn--pill" onClick={reset}>
              Clock out
            </button>
          </>
        )}
      </div>

      <dl className="dialpreview__readout">
        <div><dt>state</dt><dd>{state}</dd></div>
        <div><dt>progress</dt><dd>{progress.toFixed(3)}</dd></div>
        <div><dt>worked</dt><dd>{formatElapsed(elapsed)}</dd></div>
        <div><dt>runs</dt><dd>{cycles}</dd></div>
      </dl>

      {timedOut && (
        <p className="dialpreview__note">
          Stopped after 5 minutes idle. Press Clock in to start again.
        </p>
      )}
    </div>
  );
}
