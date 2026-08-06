import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSummary, listEvents } from '../api/stats.js';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import SegmentedControl from '../components/common/SegmentedControl.jsx';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Spinner from '../components/common/Spinner.jsx';
import { formatTime } from '../utils/format.js';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// The unit travels with the metric so the chart header, the total and the
// tooltip cannot drift apart and label hours as miles.
const METRICS = [
  { value: 'hours', label: 'Hours', unit: 'h' },
  { value: 'visits', label: 'Visits', unit: '' },
  { value: 'miles', label: 'Miles', unit: 'mi' },
];

// One decimal, and no trailing ".0" on a whole number.
const round1 = (n) => Math.round(n * 10) / 10;

export default function OverviewPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [metric, setMetric] = useState('hours');
  // Highlighted bar, defaults to today.
  const [activeDay, setActiveDay] = useState(() => (new Date().getDay() + 6) % 7);
  // 0 is this week; negative steps back. Never positive.
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getSummary(), listEvents()])
      .then(([s, e]) => {
        if (!active) return;
        setSummary(s);
        setEvents(e);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const series = useMemo(() => summary?.weekly?.[metric] ?? [], [summary, metric]);
  const max = useMemo(() => Math.max(...series, 1), [series]);
  const activeMetric = METRICS.find((m) => m.value === metric) ?? METRICS[0];

  const total = useMemo(() => round1(series.reduce((sum, v) => sum + v, 0)), [series]);
  // Averaged over the days actually worked, not over seven. Dividing a
  // four-day week by seven reports an average nobody worked.
  const avg = useMemo(() => {
    const worked = series.filter((v) => v > 0);
    return worked.length ? round1(total / worked.length) : 0;
  }, [series, total]);

  // Week range label (Mon to Sun), offset by however many weeks back the
  // carer has stepped. Stepping forward past this week is blocked, because
  // there is nothing recorded there yet.
  const range = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return { from: fmt(monday), to: fmt(sunday), year: monday.getFullYear() };
  }, [weekOffset]);

  // Stepping the week only moves the label for now. The summary endpoint has
  // no week parameter, so pretending the figures had changed would be worse
  // than leaving them; see api_missing.md.
  function shiftWeek(delta) {
    setWeekOffset((w) => Math.min(0, w + delta));
  }

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="page--flush">
      <ScreenHeader
        title="Overview"
        back
        onBack={() => navigate('/home')}
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label="Timesheet"
            onClick={() => navigate('/timesheet')}
          >
            <Icon name="wallet" size={19} />
          </button>
        }
      />

      <p className="ov-sub">Weekly view</p>

      <Card className="range-card">
        <div className="range-card__row">
          <button
            type="button"
            className="round-btn"
            aria-label="Previous week"
            onClick={() => shiftWeek(-1)}
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="range-card__year">{range.year}</span>
          <button
            type="button"
            className="round-btn"
            aria-label="Next week"
            onClick={() => shiftWeek(1)}
            disabled={weekOffset >= 0}
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="range-card__dates">
          <span>{range.from}</span>
          <span className="range-card__to">TO</span>
          <span>{range.to}</span>
        </div>
      </Card>

      {/* The week in three figures, before the chart breaks it down by day. */}
      <div className="ov-tiles">
        <div className="ov-tile">
          <span className="ov-tile__value">{summary?.week?.shifts ?? 0}</span>
          <span className="ov-tile__label">Shifts</span>
        </div>
        <div className="ov-tile">
          <span className="ov-tile__value">{summary?.week?.visits ?? summary?.week?.shifts ?? 0}</span>
          <span className="ov-tile__label">Visits</span>
        </div>
        <div className="ov-tile">
          <span className="ov-tile__value">{summary?.week?.clients ?? 0}</span>
          <span className="ov-tile__label">Clients</span>
        </div>
      </div>

      <div className="inset">
        <SegmentedControl options={METRICS} value={metric} onChange={setMetric} />
      </div>

      <Card className="chart-card">
        <div className="chart-card__head">
          <span className="chart-card__title">{activeMetric.label} per day</span>
          <span className="chart-card__avg">avg {avg}{activeMetric.unit}</span>
        </div>
        <p className="chart-card__total">
          {total}
          <span className="chart-card__unit">{activeMetric.unit}</span>
        </p>

        <div className="chart">
          {series.map((v, i) => (
            <button
              key={i}
              type="button"
              className="chart__col"
              onClick={() => setActiveDay(i)}
              aria-label={`${FULL_DAYS[i]}: ${v}${activeMetric.unit}`}
              aria-pressed={i === activeDay}
            >
              <span className="chart__bar-wrap">
                <span
                  className={[
                    'chart__bar',
                    i === activeDay && 'chart__bar--active',
                    // Saturday and Sunday, picked out so a weekend shift is
                    // obvious without counting along the axis.
                    i >= 5 && 'chart__bar--weekend',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ height: `${Math.max((v / max) * 100, 3)}%` }}
                >
                  {/* The figure for the selected day, sitting on top of its
                      own bar so it tracks the bar's height. Reading a value
                      off a bar by eye is guesswork, and this is a timesheet:
                      the number matters more than the shape. */}
                  {i === activeDay && (
                    <span className="chart__tip">
                      {v}
                      {activeMetric.unit}
                    </span>
                  )}
                </span>
              </span>
              <span className={`chart__label${i === activeDay ? ' chart__label--active' : ''}`}>
                {DAYS[i]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="section-head section-head--inset">
        <span className="section-head__title">Recent clock-ins</span>
        <button
          type="button"
          className="section-head__link"
          onClick={() => navigate('/timesheet')}
        >
          See all
        </button>
      </div>

      <Card padded={false} className="stack-card">
        {events.map((e) => (
          <div key={e.id} className="event-row">
            <span className={`event-row__icon event-row__icon--${e.type}`}>
              <Icon name={e.type === 'in' ? 'arrowUp' : 'arrowDown'} size={15} />
            </span>
            <span className="event-row__body">
              <span className="event-row__title">
                Clocked {e.type === 'in' ? 'in' : 'out'} for {e.client}
              </span>
              <span className="event-row__sub">{e.place}</span>
            </span>
            <span className="event-row__time">{formatTime(e.at)}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
