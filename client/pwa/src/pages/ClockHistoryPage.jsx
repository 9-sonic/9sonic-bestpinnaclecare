import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listClockHistory } from '../api/stats.js';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Icon from '../components/common/Icon.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { SkeletonList } from '../components/common/Skeleton.jsx';
import { formatTime } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

// Built from the Penpot board "Clock History": a filter row, then entries
// grouped by day with a per-day summary, then rows carrying direction,
// verification, time and duration.
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'review', label: 'Flagged' },
  { value: 'missing', label: 'Not submitted' },
];

const STATE_LABEL = { verified: 'Verified', review: 'Review', missing: 'Not submitted' };

// Minutes as the design writes them: "1h 33m", "27m".
function duration(mins) {
  if (mins === 'open' || mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

const dateOf = (date) =>
  new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

// "Today" / "Yesterday", or null for any other day. Returning null rather than
// the date matters: the heading shows the name and the date side by side, and
// for an ordinary day both were the same string, so it read "Wed 5 Aug Wed 5
// Aug".
function relativeDay(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return null;
}

export default function ClockHistoryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let active = true;
    listClockHistory()
      .then((data) => active && setEntries(data))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.state === filter)),
    [entries, filter]
  );

  // Grouped by day, newest first, each group carrying its own totals. The
  // summary counts clock-ins rather than rows, since one visit is two rows.
  const days = useMemo(() => {
    const map = new Map();
    shown.forEach((e) => {
      const key = new Date(e.at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.entries()].map(([key, items]) => {
      const visits = items.filter((i) => i.kind === 'in').length;
      const mins = items.reduce(
        (sum, i) => sum + (typeof i.minutes === 'number' ? i.minutes : 0),
        0
      );
      return { key, items, visits, mins };
    });
  }, [shown]);

  return (
    <div className="page--flush">
      <ScreenHeader title="" back onBack={() => navigate(-1)} />

      <div className="chist__head">
        <h1 className="chist__title">Clock ins &amp; outs</h1>
        <span className="chist__count">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="chist__filters" role="tablist" aria-label="Filter entries">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`chip${filter === f.value ? ' chip--on' : ''}`}
            onClick={() => { tapFeedback(); setFilter(f.value); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : days.length === 0 ? (
        <EmptyState
          icon="clock"
          title={filter === 'all' ? 'Nothing recorded yet' : 'Nothing matches that filter'}
          text={
            filter === 'all'
              ? 'Your clock ins and outs will appear here once you start a visit.'
              : 'Try a different filter to see the rest of your entries.'
          }
        />
      ) : (
        days.map((day) => (
          <section key={day.key} className="chist__day">
            <div className="chist__dayhead">
              <span className="chist__dayname">
                {relativeDay(day.key) ?? dateOf(day.key)}
              </span>
              {/* The date only repeats when the name above it is relative. */}
              {relativeDay(day.key) && (
                <span className="chist__daydate">{dateOf(day.key)}</span>
              )}
              <span className="chist__daysum">
                {day.visits} {day.visits === 1 ? 'visit' : 'visits'}
                {day.mins > 0 && ` · ${duration(day.mins)}`}
              </span>
            </div>

            <div className="chist__card">
              {day.items.map((e) => (
                <div key={e.id} className="chist__row">
                  {/* Direction is an arrow and a colour together, never colour
                      alone: up and green for in, down and pink for out. */}
                  <span className={`chist__dir chist__dir--${e.kind}`}>
                    <Icon name={e.kind === 'in' ? 'arrowUp' : 'arrowDown'} size={16} />
                  </span>

                  <div className="chist__body">
                    <div className="chist__line">
                      <span className="chist__name">{e.client}</span>
                      <span className={`chist__badge chist__badge--${e.state}`}>
                        {e.state === 'review' && <Icon name="alert" size={10} />}
                        {STATE_LABEL[e.state]}
                      </span>
                    </div>
                    <p className="chist__where">
                      Clocked {e.kind === 'in' ? 'in' : 'out'} · {e.place.split(',')[0]}
                    </p>
                  </div>

                  <div className="chist__side">
                    <span className="chist__time">{formatTime(e.at)}</span>
                    {e.minutes === 'open' ? (
                      <span className="chist__open">Open</span>
                    ) : (
                      duration(e.minutes) && (
                        <span className="chist__dur">{duration(e.minutes)}</span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {/* What "Verified" means here, said plainly. The API has no verification
          flag on a clock event, so this reflects the state of the visit, not a
          check by the office. Better to say so than to imply an assurance
          nobody has given. */}
      {!loading && days.length > 0 && (
        <p className="chist__note">
          <Icon name="info" size={13} />
          Verified means the visit was submitted and settled. Anything the office
          has queried shows as Review.
        </p>
      )}
    </div>
  );
}
