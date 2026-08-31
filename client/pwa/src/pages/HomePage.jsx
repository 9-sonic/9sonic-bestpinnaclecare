import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useInboxNotifications } from '../hooks/useInboxNotifications.js';
import { useShiftUpdates } from '../hooks/useShiftUpdates.js';
import { getSummary } from '../api/stats.js';
import { getClockStatus } from '../api/clock.js';
import { listShifts } from '../api/shifts.js';
import { listCoverOffers, acceptCoverOffer, declineCoverOffer } from '../api/cover.js';
import { listNotifications, markAllRead } from '../api/notifications.js';
import { useMenu } from '../components/layout/MenuContext.js';
import Icon from '../components/common/Icon.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import Skeleton, { SkeletonCard, SkeletonList } from '../components/common/Skeleton.jsx';
import ShiftCard from '../components/shifts/ShiftCard.jsx';
import { formatTime, formatTimeRange, formatDayLabel } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';
import { prefetchRoute } from '../utils/prefetch.js';
import { useExitConfirm } from '../hooks/useExitConfirm.js';
import { useToast } from '../context/ToastContext.jsx';

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
      <span className="hours-ring__sub">of {target}h scheduled</span>
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

// Where a carer goes when the day has no visits on it. Every one of these is a
// route that already exists, so nothing here promises a screen we do not have.
const QUICK_ACTIONS = [
  { to: '/clock', icon: 'clock', tint: 'teal', label: 'Clock in / out', hint: 'Start or end a shift' },
  { to: '/shifts', icon: 'calendar', tint: 'blue', label: 'My rota', hint: 'Visits this week' },
  { to: '/messages', icon: 'chat', tint: 'green', label: 'Messages', hint: 'Talk to the office' },
  // Availability is not surfaced for now — same call as the Profile screen and
  // the menu drawer. Uncomment to bring it back; the route still works.
  // { to: '/profile/availability', icon: 'user', tint: 'amber', label: 'Availability', hint: 'When you can work' },
  { to: '/help', icon: 'help', tint: 'pink', label: 'Help', hint: 'Guides and contacts' },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openMenu } = useMenu();
  const [summary, setSummary] = useState(null);
  const [clock, setClock] = useState({ clockedIn: false, shift: null });
  const [shifts, setShifts] = useState([]);
  const [coverOffers, setCoverOffers] = useState([]);
  const [coverBusy, setCoverBusy] = useState(null); // offer id being accepted/declined
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const toast = useToast();

  // Back on home warns instead of retracing the carer's steps through every
  // screen they have already visited. See useExitConfirm for why this is a
  // toast and a second press, not a dialog trying to force the app closed.
  useExitConfirm(true, () => toast.info('Press back again to exit', 2000));

  useEffect(() => {
    let active = true;
    Promise.all([getSummary(), getClockStatus(), listShifts(), listNotifications(), listCoverOffers()])
      .then(([s, c, sh, n, co]) => {
        if (!active) return;
        setSummary(s);
        setClock(c);
        setShifts(sh);
        setNotifications(n);
        setCoverOffers(co);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // The bell here is the carer's main sight of anything the office sends, so it
  // updates when the notification arrives rather than on the next page load.
  const refreshNotifications = useCallback(
    () => listNotifications().then(setNotifications).catch(() => {}),
    []
  );
  useInboxNotifications(refreshNotifications);

  // Keep the home screen's shift list (next/today) live when the office changes
  // the carer's rota, matching the calendar page.
  const refreshShifts = useCallback(
    () => listShifts().then(setShifts).catch(() => {}),
    []
  );
  useShiftUpdates(refreshShifts);

  // Accept a cover offer. Online-only: it's confirmed live or it fails clearly
  // (someone else took it, or a clash). On success the shift joins the carer's
  // list, so refresh it and drop the offer.
  async function onAcceptCover(offer) {
    if (coverBusy) return;
    setCoverBusy(offer.id);
    try {
      await acceptCoverOffer(offer.id);
      setCoverOffers((list) => list.filter((o) => o.id !== offer.id));
      listShifts().then(setShifts).catch(() => {});
      toast.success(`You're covering ${offer.client}`);
    } catch (e) {
      const msg = e?.message === 'visit_already_filled' ? 'That visit was just taken by someone else.'
        : e?.message === 'carer_unavailable' ? 'This clashes with a visit you already have.'
          : 'Could not accept — please try again.';
      toast.error(msg);
      // Either way it's no longer acceptable by this carer — clear it.
      setCoverOffers((list) => list.filter((o) => o.id !== offer.id));
    } finally {
      setCoverBusy(null);
    }
  }

  async function onDeclineCover(offer) {
    if (coverBusy) return;
    setCoverBusy(offer.id);
    try {
      await declineCoverOffer(offer.id);
      setCoverOffers((list) => list.filter((o) => o.id !== offer.id));
    } catch {
      toast.error('Could not decline — please try again.');
    } finally {
      setCoverBusy(null);
    }
  }

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

  // The soonest visit after today. Only read when today is empty, where it is
  // the one piece of real information that answers "so when am I next out?".
  const nextUp = useMemo(() => {
    const now = Date.now();
    return shifts
      .filter((s) => new Date(s.startsAt).getTime() > now && s.status === 'upcoming')
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] ?? null;
  }, [shifts]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0];
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Worked vs scheduled hours this week, shown as a ring under the metrics.
  const target = week?.hoursTarget ?? 40;
  const worked = week?.hours ?? 0;

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
          {/* The bottom nav already has a Profile tab that navigates there in
              one tap, so this one tap does something the nav can't: a closer
              look at your own photo, with going to the full profile as a
              clearly separate, deliberate second step rather than the only
              thing tapping your own face can do. */}
          <button
            type="button"
            className="home2__avatar"
            aria-label="View your photo"
            onClick={() => { tapFeedback(); setAvatarOpen(true); }}
          >
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

      {/* Stands in for whichever of the featured-visit card or the "no visits"
          card is coming, so the fetch window never drops straight to the bare
          stats row. Same shape budget as either one: one card. */}
      {loading && (
        <section className="home-sec">
          <SkeletonCard />
        </section>
      )}

      {!loading && focus && (
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

      {/* Nothing on the rota today. The page still has to say something true and
          leave the carer somewhere to go, otherwise everything below the stats
          is blank space. Held back until the fetch settles so an empty first
          render does not flash "no visits" at someone who has six. */}
      {!loading && today.length === 0 && (
        <section className="home-sec">
          <article className="dayclear">
            <span className="dayclear__icon">
              <Icon name="calendar" size={24} />
            </span>
            <h3 className="dayclear__title">No visits today</h3>
            <p className="dayclear__text">
              {nextUp
                ? `Your next visit is ${formatDayLabel(nextUp.startsAt)} at ${formatTime(nextUp.startsAt)}.`
                : 'Nothing is on your rota yet. The office will let you know as soon as a visit is assigned.'}
            </p>
            <div className="dayclear__actions">
              {nextUp && (
                <button
                  type="button"
                  className="dayclear__btn dayclear__btn--solid"
                  onClick={() => { tapFeedback(); navigate(`/shifts/${nextUp.id}`); }}
                >
                  View next visit
                </button>
              )}
              <button
                type="button"
                className="dayclear__btn"
                onClick={() => { tapFeedback(); navigate('/shifts'); }}
              >
                See my rota
              </button>
            </div>
          </article>
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
            onClick={() => navigate('/overview')}
          />
        </div>
      </section>

      {/* The rest of the day. Each row carries enough to act on without
          opening it: when, who, where, and what the visit is for. */}
      {/* Stands in for whichever of the today list or the quick-actions grid is
          coming. Two rows, roughly the footprint of either. */}
      {loading && (
        <section className="home-sec">
          <SkeletonList count={2} />
        </section>
      )}

      {!loading && coverOffers.length > 0 && (
        <section className="home-sec">
          <div className="section-head section-head--inset">
            <span className="section-head__title">Cover available</span>
            <span className="today__count">{coverOffers.length} open</span>
          </div>
          <div className="vlist">
            {coverOffers.map((o) => (
              <article key={o.id} className="cover-offer">
                <div className="cover-offer__body">
                  <span className="cover-offer__time">{formatTimeRange(o.startsAt, o.endsAt)}</span>
                  <h3 className="cover-offer__name">{o.client}</h3>
                  {o.address && <p className="cover-offer__addr">{o.address}</p>}
                  {o.note && <p className="cover-offer__note">“{o.note}”</p>}
                </div>
                <div className="cover-offer__actions">
                  <button
                    type="button"
                    className="cover-offer__btn"
                    disabled={coverBusy === o.id}
                    onClick={() => onDeclineCover(o)}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="cover-offer__btn cover-offer__btn--solid"
                    disabled={coverBusy === o.id}
                    onClick={() => onAcceptCover(o)}
                  >
                    {coverBusy === o.id ? 'Accepting…' : 'Accept'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && today.length > 0 && (
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

      {/* Only on a clear day. On a day with visits the list below is what the
          carer came for, and a grid of links under it would compete with it. */}
      {!loading && today.length === 0 && (
        <section className="home-sec">
          <div className="section-head section-head--inset">
            <span className="section-head__title">Quick actions</span>
          </div>
          <div className="qgrid">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.to}
                type="button"
                className="qgrid__item"
                onPointerDown={() => prefetchRoute(a.to)}
                onClick={() => { tapFeedback(); navigate(a.to); }}
              >
                <span className={`qgrid__icon tile-icon tile-icon--${a.tint}`}>
                  <Icon name={a.icon} size={18} />
                </span>
                <span className="qgrid__label">{a.label}</span>
                <span className="qgrid__hint">{a.hint}</span>
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
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        title="Your photo"
        footer={
          <Button block onClick={() => { setAvatarOpen(false); navigate('/profile'); }}>
            Go to my profile
          </Button>
        }
      >
        <div className="avatar-preview">
          <Avatar name={user?.name ?? ''} src={user?.avatar} size={160} ring />
          <p className="avatar-preview__name">{user?.name}</p>
        </div>
      </Modal>

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
