import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getSummary } from '../api/stats.js';
import { getClockStatus } from '../api/clock.js';
import { listShifts } from '../api/shifts.js';
import { listNotifications, markAllRead } from '../api/notifications.js';
import { useMenu } from '../components/layout/MenuContext.js';
import Icon from '../components/common/Icon.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { formatTime, formatTimeRange, formatDayLabel } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

// The two gradient cards at the top of the design. Each carries a headline
// figure and how it has moved, with a small trend chip in the corner.
function HeroStat({ label, value, delta, loading, onClick }) {
  const up = (delta ?? 0) >= 0;
  return (
    <button type="button" className="hero" onClick={() => { tapFeedback(); onClick?.(); }}>
      <span className="hero__top">
        <span className="hero__label">{label}</span>
        <span className="hero__chip">
          <Icon name={up ? 'trend' : 'arrowDown'} size={13} />
        </span>
      </span>

      {loading ? (
        <Skeleton w="60%" h={26} />
      ) : (
        <span className="hero__value">{value}</span>
      )}

      <span className="hero__delta">
        {delta == null ? '\u00a0' : `${up ? '+' : ''}${delta}%`}
      </span>
    </button>
  );
}

// The 2x2 grid underneath: a pastel icon tile, an uppercase label, then the
// figure with its unit trailing in a lighter weight.
function MetricCard({ icon, tint, label, value, unit, loading, onClick }) {
  return (
    <button type="button" className="metric" onClick={() => { tapFeedback(); onClick?.(); }}>
      <span className={`tile-icon tile-icon--${tint}`}>
        <Icon name={icon} size={17} />
      </span>
      <span className="metric__label">{label}</span>
      {loading ? (
        <Skeleton w="55%" h={22} />
      ) : (
        <span className="metric__figure">
          <span className="metric__value">{value}</span>
          {unit && <span className="metric__unit">{unit}</span>}
        </span>
      )}
    </button>
  );
}

// The destinations that are not on the tab bar. Kept short deliberately: a
// shortcut row that lists everything is just a second menu.
const QUICK = [
  { to: '/timesheet', icon: 'wallet', label: 'Timesheet', tint: 'green' },
  { to: '/overview', icon: 'trend', label: 'Overview', tint: 'purple' },
  { to: '/notifications', icon: 'bell', label: 'Alerts', tint: 'amber' },
  { to: '/help', icon: 'help', label: 'Help', tint: 'blue' },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openMenu } = useMenu();
  const [summary, setSummary] = useState(null);
  const [clock, setClock] = useState({ clockedIn: false, shift: null });
  const [shifts, setShifts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getSummary(), getClockStatus(), listShifts(), listNotifications()])
      .then(([s, c, sh, n]) => {
        if (!active) return;
        setSummary(s);
        setClock(c);
        setShifts(sh);
        setNotifications(n);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const week = summary?.week;
  const unread = notifications.filter((n) => !n.read).length;

  const today = useMemo(() => {
    const now = new Date();
    return shifts.filter((s) => new Date(s.startsAt).toDateString() === now.toDateString());
  }, [shifts]);

  const focus = useMemo(() => {
    if (clock.shift) return clock.shift;
    return today
      .filter((s) => s.status === 'upcoming')
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] ?? null;
  }, [today, clock.shift]);

  const remaining = today.filter((s) => s.status === 'upcoming').length;
  const doneToday = today.filter((s) => s.status === 'completed').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Progress towards the contracted week, shown as a bar under the metrics.
  const target = week?.hoursTarget ?? 40;
  const worked = week?.hours ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((worked / target) * 100)) : 0;

  async function handleReadAll() {
    tapFeedback();
    await markAllRead(notifications.filter((n) => !n.read).map((n) => n.id));
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="page--flush home2">
      <header className="home2__bar">
        <button type="button" className="icon-btn" aria-label="Open menu" onClick={() => { tapFeedback(); openMenu(); }}>
          <Icon name="menu" size={22} />
        </button>

        <h1 className="home2__title">Home</h1>

        <div className="home2__actions">
          <button
            type="button"
            className="icon-btn home2__bell"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            onClick={() => { tapFeedback(); setBellOpen(true); }}
          >
            <Icon name="dots" size={20} />
            {unread > 0 && <span className="home2__dot" />}
          </button>
          <button type="button" className="home2__avatar" aria-label="Your profile" onClick={() => navigate('/profile')}>
            <Avatar name={user?.name ?? ''} src={user?.avatar} size={36} />
          </button>
        </div>
      </header>

      <div className="greet">
        <p className="greet__hello">
          {greeting}, <span>{firstName ?? 'there'}</span>
        </p>
        <p className="greet__sub">{todayLabel}</p>
      </div>

      <div className="hero-row">
        <HeroStat
          label="Active Shifts"
          value={week?.shifts ?? 0}
          delta={week?.shiftsDelta ?? null}
          loading={loading}
          onClick={() => navigate('/shifts')}
        />
        <HeroStat
          label="Visits"
          value={week?.visits ?? week?.shifts ?? 0}
          delta={week?.visitsDelta ?? null}
          loading={loading}
          onClick={() => navigate('/overview')}
        />
      </div>

      <div className="metric-grid">
        <MetricCard
          icon="calendar"
          tint="blue"
          label="Shifts"
          value={week?.shifts ?? 0}
          unit="this week"
          loading={loading}
          onClick={() => navigate('/shifts')}
        />
        <MetricCard
          icon="clock"
          tint="mint"
          label="Hours"
          value={week?.hours ?? 0}
          unit="hrs"
          loading={loading}
          onClick={() => navigate('/overview')}
        />
        <MetricCard
          icon="users"
          tint="green"
          label="Clients"
          value={week?.clients ?? 0}
          unit="active"
          loading={loading}
          onClick={() => navigate('/shifts')}
        />
        <MetricCard
          icon="trend"
          tint="purple"
          label="Miles"
          value={week?.miles ?? 0}
          unit="mi"
          loading={loading}
          onClick={() => navigate('/timesheet')}
        />
      </div>

      {/* Weekly progress. The four figures above say what has happened; this
          says how much of the week is left, which is the thing carers actually
          ask. */}
      <section className="weekbar-card">
        <div className="weekbar-card__top">
          <span className="weekbar-card__label">Hours this week</span>
          <span className="weekbar-card__value">
            {worked}
            <span className="weekbar-card__of">of {target}</span>
          </span>
        </div>
        <div className="weekbar" role="img" aria-label={`${worked} of ${target} hours worked`}>
          <span className="weekbar__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="weekbar-card__foot">
          <span>{pct}% complete</span>
          <span>{Math.max(0, Math.round((target - worked) * 10) / 10)} hrs to go</span>
        </div>
      </section>

      {/* Quick ways into the screens that are not on the tab bar. */}
      <section className="quick">
        <div className="section-head section-head--inset">
          <span className="section-head__title">Quick actions</span>
        </div>
        <div className="quick__row">
          {QUICK.map((q) => (
            <button
              key={q.to}
              type="button"
              className="quick__item"
              onClick={() => { tapFeedback(); navigate(q.to); }}
            >
              <span className={`tile-icon tile-icon--${q.tint}`}>
                <Icon name={q.icon} size={18} />
              </span>
              <span className="quick__label">{q.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Kept from the working build: the design shows the grid alone, but a
          carer opening the app needs to see what they are doing next. */}
      {focus && (
        <section className="upnext2">
          <div className="section-head section-head--inset">
            <span className="section-head__title">
              {clock.clockedIn ? 'On shift now' : 'Up next'}
            </span>
            <button type="button" className="section-head__link" onClick={() => navigate('/shifts')}>
              See All
            </button>
          </div>

          <button
            type="button"
            className={`upnext2__card${clock.clockedIn ? ' upnext2__card--live' : ''}`}
            onClick={() => { tapFeedback(); navigate(`/shifts/${focus.id}`); }}
          >
            <Avatar name={focus.client} size={44} />
            <span className="upnext2__body">
              <span className="upnext2__name">{focus.client}</span>
              <span className="upnext2__meta">
                <Icon name="clock" size={13} />
                {formatTimeRange(focus.startsAt, focus.endsAt)}
              </span>
              <span className="upnext2__addr">
                <Icon name="pin" size={13} />
                {focus.address.split(',')[0]}
              </span>
            </span>
            <span className={`badge badge--${clock.clockedIn ? 'active' : 'upcoming'}`}>
              {clock.clockedIn ? 'On shift' : 'Upcoming'}
            </span>
          </button>

          <div className="upnext2__actions">
            <Button size="lg" block onClick={() => navigate(`/clock?shift=${focus.id}`)}>
              <Icon name={clock.clockedIn ? 'stop' : 'play'} size={15} filled />
              {clock.clockedIn ? 'Clock out' : 'Clock in'}
            </Button>
          </div>
        </section>
      )}

      {/* The rest of the day, so the screen answers more than one question. */}
      {today.length > 1 && (
        <section className="today">
          <div className="section-head section-head--inset">
            <span className="section-head__title">Today</span>
            <span className="today__count">
              {doneToday} of {today.length} done
            </span>
          </div>

          <div className="today__list">
            {today
              .slice()
              .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`today__row today__row--${s.status}`}
                  onClick={() => { tapFeedback(); navigate(`/shifts/${s.id}`); }}
                >
                  <span className="today__rail" aria-hidden="true">
                    <span className="today__dot" />
                  </span>
                  <span className="today__time">{formatTime(s.startsAt)}</span>
                  <span className="today__who">
                    <span className="today__name">{s.client}</span>
                    <span className="today__addr">{s.address.split(',')[0]}</span>
                  </span>
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
          </div>
        </section>
      )}

      {remaining === 0 && today.length > 0 && (
        <p className="home-note">
          <Icon name="check" size={14} />
          Everything for today is done. Nice work.
        </p>
      )}

      <p className="home-foot">
        <Icon name="pin" size={13} />
        Your location is only recorded when you clock in or out.
      </p>

      <Modal
        open={bellOpen}
        onClose={() => setBellOpen(false)}
        title="Notifications"
        footer={
          <Button block variant="white" onClick={() => { setBellOpen(false); navigate('/notifications'); }}>
            See all
          </Button>
        }
      >
        {notifications.length === 0 ? (
          <p className="modal__empty">Nothing new right now.</p>
        ) : (
          <>
            {unread > 0 && (
              <button type="button" className="text-btn modal__action" onClick={handleReadAll}>
                Mark all as read
              </button>
            )}
            <div className="bell-list">
              {notifications.slice(0, 5).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`bell-item${n.read ? '' : ' bell-item--unread'}`}
                  onClick={() => { tapFeedback(); setBellOpen(false); navigate(n.link ?? '/notifications'); }}
                >
                  <span className="bell-item__body">
                    <span className="bell-item__title">{n.title}</span>
                    <span className="bell-item__text">{n.text}</span>
                    <span className="bell-item__time">
                      {formatDayLabel(n.at)} at {formatTime(n.at)}
                    </span>
                  </span>
                  {!n.read && <span className="bell-item__dot" aria-label="Unread" />}
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
