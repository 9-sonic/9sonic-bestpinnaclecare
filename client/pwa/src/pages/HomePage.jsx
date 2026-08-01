import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { getSummary } from '../api/stats.js';
import { getClockStatus } from '../api/clock.js';
import { listShifts } from '../api/shifts.js';
import { listNotifications, markAllRead } from '../api/notifications.js';
import { useMenu } from '../components/layout/MenuContext.js';
import Card from '../components/common/Card.jsx';
import Icon from '../components/common/Icon.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { formatTime, formatTimeRange, formatDayLabel } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

// The carer's landing screen.
//
// Structure follows the question a carer actually opens the app to answer:
// "what am I doing next, and am I meant to be somewhere now?" So the running or
// next visit is the largest thing on the page and everything else is support.
// The week's figures sit underneath as a quiet strip, not four competing cards.

function StatCard({ icon, tone, label, value, hint, loading, onClick }) {
  return (
    <button type="button" className="stat-card" onClick={() => { tapFeedback(); onClick?.(); }}>
      <span className={`stat-card__icon stat-card__icon--${tone}`}>
        <Icon name={icon} size={16} />
      </span>
      {loading ? (
        <Skeleton w="50%" h={20} />
      ) : (
        <span className="stat-card__value">{value}</span>
      )}
      <span className="stat-card__label">{label}</span>
      {hint && <span className="stat-card__hint">{hint}</span>}
    </button>
  );
}

// Shortcuts to the things that are not on the tab bar. Without these the page
// ended below the week figures with a large empty area on a tall phone.
const SHORTCUTS = [
  { to: '/timesheet', icon: 'wallet', label: 'Timesheet', hint: 'Check your hours' },
  { to: '/overview', icon: 'trend', label: 'Overview', hint: 'Your week in numbers' },
  { to: '/profile/availability', icon: 'calendar', label: 'Availability', hint: 'Days you can work' },
  { to: '/help', icon: 'help', label: 'Help', hint: 'Answers and contacts' },
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
  const pct = week?.hoursTarget ? Math.min(100, Math.round((week.hoursWorked / week.hoursTarget) * 100)) : 0;
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

  async function handleReadAll() {
    tapFeedback();
    await markAllRead(notifications.filter((n) => !n.read).map((n) => n.id));
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="page--flush">
      <header className="home-top">
        <button
          type="button"
          className="icon-btn"
          aria-label="Open menu"
          onClick={() => { tapFeedback(); openMenu(); }}
        >
          <Icon name="menu" size={21} />
        </button>

        <span className="home-top__brand">
          <img src="/logo.png" alt="" className="home-top__logo" />
        </span>

        <div className="home-top__actions">
          <button
            type="button"
            className="icon-btn home-top__bell"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            onClick={() => { tapFeedback(); setBellOpen(true); }}
          >
            <Icon name="bell" size={20} />
            {unread > 0 && <span className="home-top__bell-count">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Your profile"
            onClick={() => navigate('/profile')}
          >
            <Avatar name={user?.name ?? ''} src={user?.avatar} size={28} />
          </button>
        </div>
      </header>

      <div className="home-greeting">
        <p className="home-greeting__hello">
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </p>
        <p className="home-greeting__sub">{formatDayLabel(new Date().toISOString())}</p>
      </div>

      {/* The one thing that matters most, given the biggest area on the page. */}
      {loading ? (
        <div className="focus-card focus-card--loading">
          <Skeleton w="40%" h={13} />
          <Skeleton w="70%" h={22} />
          <Skeleton w="55%" h={13} />
        </div>
      ) : focus ? (
        <section className={`focus-card${clock.clockedIn ? ' focus-card--live' : ''}`}>
          <div className="focus-card__head">
            <span className="focus-card__eyebrow">
              {clock.clockedIn ? (
                <>
                  <span className="live-dot" aria-hidden="true" />
                  On shift now
                </>
              ) : (
                'Next visit'
              )}
            </span>
            <span className="focus-card__time">
              {clock.clockedIn ? `since ${formatTime(focus.clockInAt)}` : formatTime(focus.startsAt)}
            </span>
          </div>

          <button
            type="button"
            className="focus-card__body"
            onClick={() => { tapFeedback(); navigate(`/shifts/${focus.id}`); }}
          >
            <Avatar name={focus.client} size={44} />
            <span className="focus-card__who">
              <span className="focus-card__name">{focus.client}</span>
              <span className="focus-card__meta">
                {formatTimeRange(focus.startsAt, focus.endsAt)}
              </span>
              <span className="focus-card__addr">
                <Icon name="pin" size={13} />
                {focus.address.split(',')[0]}
              </span>
            </span>
            <Icon name="chevronRight" size={18} />
          </button>

          <div className="focus-card__actions">
            <Button
              size="md"
              block
              onClick={() => { tapFeedback(); navigate(`/clock?shift=${focus.id}`); }}
            >
              <Icon name={clock.clockedIn ? 'stop' : 'play'} size={14} filled />
              {clock.clockedIn ? 'Clock out' : 'Clock in'}
            </Button>
            <Button
              variant="white"
              size="md"
              onClick={() => { tapFeedback(); navigate(`/navigate/${focus.id}`); }}
              aria-label="Directions"
            >
              <Icon name="location" size={15} />
              Directions
            </Button>
          </div>
        </section>
      ) : (
        <section className="focus-card focus-card--clear">
          <span className="focus-card__clear-icon">
            <Icon name="check" size={22} />
          </span>
          <p className="focus-card__clear-title">
            {doneToday > 0 ? "That's everything for today" : 'Nothing scheduled today'}
          </p>
          <p className="focus-card__clear-text">
            {doneToday > 0
              ? `${doneToday} ${doneToday === 1 ? 'visit' : 'visits'} completed. Enjoy the rest of your day.`
              : 'Your visits will appear here once the office publishes the rota.'}
          </p>
        </section>
      )}

      {/* Week at a glance: one row, one rule, no competing cards. */}
      <section className="week-strip" aria-label="This week">
        <div className="week-strip__head">
          <span className="week-strip__title">This week</span>
          <button
            type="button"
            className="week-strip__link"
            onClick={() => navigate('/overview')}
          >
            Details
          </button>
        </div>

        <div
          className="week-bar"
          role="img"
          aria-label={`${week?.hoursWorked ?? 0} of ${week?.hoursTarget ?? 40} hours worked`}
        >
          <span className="week-bar__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="week-bar__caption">
          <span>
            <b>{week?.hoursWorked ?? 0}</b> of {week?.hoursTarget ?? 40} hours
          </span>
          <span>{pct}%</span>
        </div>

        {/* The four figures a carer checks, as tappable cards. Each one is a
            way into the screen that explains it, so the grid is navigation as
            well as summary. */}
        <div className="stat-grid">
          <StatCard
            icon="calendar"
            tone="info"
            label="Visits"
            value={week?.shifts ?? 0}
            hint="scheduled"
            loading={loading}
            onClick={() => navigate('/shifts')}
          />
          <StatCard
            icon="clock"
            tone="teal"
            label="Hours"
            value={week?.hours ?? 0}
            hint="logged"
            loading={loading}
            onClick={() => navigate('/overview')}
          />
          <StatCard
            icon="users"
            tone="green"
            label="People"
            value={week?.clients ?? 0}
            hint="supported"
            loading={loading}
            onClick={() => navigate('/shifts')}
          />
          <StatCard
            icon="check"
            tone="purple"
            label="Done"
            value={doneToday}
            hint="today"
            loading={loading}
            onClick={() => navigate('/overview')}
          />
        </div>
      </section>

      {remaining > 1 && (
        <section className="upnext">
          <div className="week-strip__head">
            <span className="week-strip__title">Later today</span>
            <button type="button" className="week-strip__link" onClick={() => navigate('/shifts')}>
              All visits
            </button>
          </div>
          <div className="upnext__list">
            {today
              .filter((s) => s.status === 'upcoming' && s.id !== focus?.id)
              .slice(0, 3)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="upnext__row"
                  onClick={() => { tapFeedback(); navigate(`/shifts/${s.id}`); }}
                >
                  <span className="upnext__time">{formatTime(s.startsAt)}</span>
                  <span className="upnext__who">
                    <span className="upnext__name">{s.client}</span>
                    <span className="upnext__addr">{s.address.split(',')[0]}</span>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </button>
              ))}
          </div>
        </section>
      )}

      <section className="shortcuts">
        <div className="week-strip__head">
          <span className="week-strip__title">Shortcuts</span>
        </div>
        <div className="shortcut-grid">
          {SHORTCUTS.map((s) => (
            <button
              key={s.to}
              type="button"
              className="shortcut"
              onClick={() => {
                tapFeedback();
                navigate(s.to);
              }}
            >
              <span className="shortcut__icon">
                <Icon name={s.icon} size={17} />
              </span>
              <span className="shortcut__text">
                <span className="shortcut__label">{s.label}</span>
                <span className="shortcut__hint">{s.hint}</span>
              </span>
              <Icon name="chevronRight" size={15} />
            </button>
          ))}
        </div>
      </section>

      {/* Reassurance rather than filler: this is the question carers ask most
          about the app, and answering it on the home screen costs nothing. */}
      <p className="home-footnote">
        <Icon name="pin" size={13} />
        Your location is only recorded when you clock in or out.
      </p>

      <Modal
        open={bellOpen}
        onClose={() => setBellOpen(false)}
        title="Notifications"
        footer={
          <Button
            block
            variant="white"
            onClick={() => {
              setBellOpen(false);
              navigate('/notifications');
            }}
          >
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
                  onClick={() => {
                    tapFeedback();
                    setBellOpen(false);
                    navigate(n.link ?? '/notifications');
                  }}
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
