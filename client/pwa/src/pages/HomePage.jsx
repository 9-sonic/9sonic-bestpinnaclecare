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
import ShiftCard from '../components/shifts/ShiftCard.jsx';
import { formatTime, formatTimeRange, formatDayLabel } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

// How far off a visit is, in the words a carer would use. Returns null once the
// visit has started, because "in -5 min" is worse than saying nothing.
function countdown(startsAt) {
  const mins = Math.round((new Date(startsAt) - Date.now()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 60) return `in ${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

// The headline card: the visit the carer is about to do, with everything
// needed to leave for it. The two inner tiles are the questions asked on the
// doorstep \u2014 when am I due, and how long will it take me to get there.
function FeaturedVisit({ shift, live, onNavigate, onProfile, onCall }) {
  const soon = countdown(shift.startsAt);
  return (
    <article className={`fvisit${live ? ' fvisit--live' : ''}`}>
      <div className="fvisit__top">
        <Avatar name={shift.client} size={48} />
        <div className="fvisit__id">
          <div className="fvisit__when">
            <span className="fvisit__time">{formatTime(shift.startsAt)}</span>
            {live ? (
              <span className="fvisit__soon">On shift</span>
            ) : (
              soon && <span className="fvisit__soon">{soon}</span>
            )}
          </div>
          <h3 className="fvisit__name">{shift.client}</h3>
          <p className="fvisit__addr">{shift.address}</p>
        </div>
        <button
          type="button"
          className="fvisit__call"
          aria-label={`Call about ${shift.client}`}
          onClick={onCall}
        >
          <Icon name="phone" size={18} />
        </button>
      </div>

      <div className="fvisit__tiles">
        <div className="fvisit__tile">
          <span className="fvisit__tile-label">
            <Icon name="clock" size={13} />
            Visit window
          </span>
          <span className="fvisit__tile-value">
            {formatTimeRange(shift.startsAt, shift.endsAt)}
          </span>
        </div>
        <div className="fvisit__tile">
          <span className="fvisit__tile-label">
            <Icon name="pin" size={13} />
            Travel
          </span>
          <span className="fvisit__tile-value">
            {shift.travelMinutes ? `${shift.travelMinutes} mins away` : 'Distance unknown'}
          </span>
        </div>
      </div>

      <div className="fvisit__actions">
        <button type="button" className="fvisit__btn fvisit__btn--solid" onClick={onNavigate}>
          Start Route
        </button>
        <button type="button" className="fvisit__btn" onClick={onProfile}>
          View Profile
        </button>
      </div>
    </article>
  );
}

// Hours worked against the contracted week, as a ring. A ring rather than a
// bar because the figure in the middle is what gets read, and the arc is only
// there to say roughly how far through the week it is.
function HoursRing({ worked, target, loading }) {
  const pct = target > 0 ? Math.min(1, worked / target) : 0;
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className="hours-ring">
      <span className="hours-ring__label">Hours</span>
      <div className="hours-ring__dial">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="hours-ring__track" cx="60" cy="60" r={R} strokeWidth="11" />
          <circle
            className="hours-ring__arc"
            cx="60"
            cy="60"
            r={R}
            strokeWidth="11"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <span className="hours-ring__value">
          {loading ? '\u2014' : worked}
          <span className="hours-ring__unit">h</span>
        </span>
      </div>
      <span className="hours-ring__sub">of {target} contracted</span>
    </div>
  );
}

// The two figures beside the ring. The sub-line matters: a bare number in a
// box is what made this row look like padding rather than information.
function MiniStat({ value, label, sub, icon, tint, loading, onClick }) {
  return (
    <button type="button" className="ministat" onClick={() => { tapFeedback(); onClick?.(); }}>
      <span className={`ministat__icon tile-icon tile-icon--${tint}`}>
        <Icon name={icon} size={15} />
      </span>
      <span className="ministat__figures">
        {loading ? (
          <Skeleton w="60%" h={22} />
        ) : (
          <span className="ministat__value">
            {value}
            {sub && <span className="ministat__sub">{sub}</span>}
          </span>
        )}
        <span className="ministat__label">{label}</span>
      </span>
    </button>
  );
}

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
            <Icon name="bell" size={20} />
            {unread > 0 && <span className="home2__badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button type="button" className="home2__avatar" aria-label="Your profile" onClick={() => navigate('/profile')}>
            <Avatar name={user?.name ?? ''} src={user?.avatar} size={36} />
          </button>
        </div>
      </header>

      <div className="greet">
        <p className="greet__sub">{todayLabel}</p>
        <h2 className="greet__hello">
          {greeting}, {firstName ?? 'there'}
        </h2>
        {today.length > 0 && (
          <span className="greet__chip">
            {remaining > 0
              ? `${remaining} visit${remaining === 1 ? '' : 's'} scheduled`
              : 'All visits done'}
          </span>
        )}
      </div>

      {focus && (
        <section className="home-sec">
          <div className="section-head section-head--inset">
            <span className="section-head__title">
              {clock.clockedIn ? 'On shift now' : 'Upcoming visits'}
            </span>
            <button type="button" className="section-head__link" onClick={() => navigate('/shifts')}>
              View all
            </button>
          </div>

          {/* The design stacks two narrower cards behind the featured one, so
              the card reads as the top of a pile rather than a lone panel.
              Only drawn when there really are more visits queued, otherwise it
              would promise a stack that is not there. */}
          <div className={`fdeck${remaining > 1 ? ' fdeck--stacked' : ''}`}>
            <FeaturedVisit
              shift={focus}
              live={clock.clockedIn}
              onNavigate={() => { tapFeedback(); navigate(`/navigate/${focus.id}`); }}
              onProfile={() => { tapFeedback(); navigate(`/shifts/${focus.id}`); }}
              onCall={() => { tapFeedback(); navigate('/messages'); }}
            />
          </div>
        </section>
      )}

      {/* The week at a glance: hours as a ring, with the two counts beside it. */}
      <section className="home-stats">
        <HoursRing worked={worked} target={target} loading={loading} />
        <div className="home-stats__col">
          <MiniStat
            value={week?.shifts ?? 0}
            sub="this week"
            label="Shifts"
            icon="calendar"
            tint="blue"
            loading={loading}
            onClick={() => navigate('/shifts')}
          />
          <MiniStat
            value={week?.clients ?? 0}
            sub="active"
            label="Clients"
            icon="users"
            tint="green"
            loading={loading}
            onClick={() => navigate('/shifts')}
          />
          <MiniStat
            value={week?.miles ?? 0}
            sub="mi"
            label="Travel"
            icon="trend"
            tint="purple"
            loading={loading}
            onClick={() => navigate('/timesheet')}
          />
        </div>
      </section>

      {/* The rest of the day. Each row carries enough to act on without
          opening it: when, who, where, and what the visit is for. */}
      {today.length > 0 && (
        <section className="home-sec">
          <div className="section-head section-head--inset">
            <span className="section-head__title">Today</span>
            <span className="today__count">
              {doneToday} of {today.length} done
            </span>
          </div>

          <div className="vlist">
            {today
              .slice()
              .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
              .map((s) => (
                <ShiftCard
                  key={s.id}
                  shift={s}
                  actions
                  onRoute={() => navigate(`/navigate/${s.id}`)}
                  onDetails={() => navigate(`/shifts/${s.id}`)}
                />
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
