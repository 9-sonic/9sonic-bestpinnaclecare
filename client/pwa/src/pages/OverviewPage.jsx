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
const METRICS = [
  { value: 'hours', label: 'Hours' },
  { value: 'visits', label: 'Visits' },
  { value: 'miles', label: 'Miles' },
];

export default function OverviewPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [metric, setMetric] = useState('hours');
  // Highlighted bar, defaults to today.
  const [activeDay, setActiveDay] = useState(() => (new Date().getDay() + 6) % 7);
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

  // Week range label (Mon to Sun of the current week).
  const range = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return { from: fmt(monday), to: fmt(sunday), year: monday.getFullYear() };
  }, []);

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

      <h2 className="screen-header__title-large" style={{ padding: '0 var(--space-4) var(--space-3)' }}>
        Weekly View
      </h2>

      <Card className="range-card">
        <div className="range-card__row">
          <Icon name="chevronLeft" size={15} />
          <span className="range-card__year">{range.year}</span>
          <Icon name="chevronRight" size={15} />
        </div>
        <div className="range-card__dates">
          <span>{range.from}</span>
          <span className="range-card__to">TO</span>
          <span>{range.to}</span>
        </div>
      </Card>

      <div className="inset">
        <SegmentedControl options={METRICS} value={metric} onChange={setMetric} />
      </div>

      <Card className="chart-card">
        <div className="chart">
          {series.map((v, i) => (
            <button
              key={i}
              type="button"
              className="chart__col"
              onClick={() => setActiveDay(i)}
              aria-label={`${DAYS[i]}: ${v}`}
            >
              <span className="chart__bar-wrap">
                <span
                  className={`chart__bar${i === activeDay ? ' chart__bar--active' : ''}`}
                  style={{ height: `${(v / max) * 100}%` }}
                />
              </span>
              <span className={`chart__label${i === activeDay ? ' chart__label--active' : ''}`}>
                {DAYS[i]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="section-head section-head--inset">
        <span className="section-head__title">Recent Clock-ins</span>
        <button
          type="button"
          className="section-head__link"
          onClick={() => navigate('/timesheet')}
        >
          View timesheet
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
