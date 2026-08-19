import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAllRead, markSeen } from '../api/notifications.js';
import { useInboxNotifications } from '../hooks/useInboxNotifications.js';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Icon from '../components/common/Icon.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { SkeletonList } from '../components/common/Skeleton.jsx';
import { formatTime, formatDayLabel } from '../utils/format.js';
import { tapFeedback } from '../utils/haptics.js';

// Tone per notification type, so a rota change and a training reminder are
// distinguishable at a glance rather than being an undifferentiated list.
const KINDS = {
  visit_changed: { icon: 'calendar', tone: 'info', label: 'Rota' },
  visit_assigned: { icon: 'calendar', tone: 'info', label: 'Rota' },
  message: { icon: 'chat', tone: 'teal', label: 'Message' },
  training_due: { icon: 'shield', tone: 'purple', label: 'Training' },
  alert: { icon: 'alert', tone: 'danger', label: 'Alert' },
};

const fallback = { icon: 'bell', tone: 'grey', label: 'Update' };

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(
    () => listNotifications().then(setItems).catch(() => {}),
    []
  );

  useEffect(() => {
    let active = true;
    listNotifications()
      .then((data) => active && setItems(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Arrives live rather than on the next visit to this screen.
  useInboxNotifications(load);

  const unread = items.filter((n) => !n.read);
  const shown = filter === 'unread' ? unread : items;

  // Grouped by day so a week of updates is readable.
  const groups = useMemo(() => {
    const map = new Map();
    shown.forEach((n) => {
      const key = formatDayLabel(n.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    });
    return [...map.entries()];
  }, [shown]);

  async function handleReadAll() {
    tapFeedback();
    await markAllRead(unread.map((n) => n.id));
    setItems((list) => list.map((n) => ({ ...n, read: true })));
  }

  async function open(n) {
    tapFeedback();
    if (!n.read) {
      markSeen(n.id);
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) navigate(n.link);
  }

  return (
    <div className="page--flush">
      <ScreenHeader title="Notifications" back onBack={() => navigate('/home')} />

      {/* The action sits on its own line rather than in the header slot: there
          it had to share 44px with the title and wrapped onto two lines. */}
      <div className="notif-head">
        <span className="notif-head__title">
          {unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
        </span>
        {unread.length > 0 && (
          <button type="button" className="notif-head__action" onClick={handleReadAll}>
            Read all
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="seg-row">
          <button
            type="button"
            className={`seg${filter === 'all' ? ' seg--on' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
            <span className="seg__count">{items.length}</span>
          </button>
          <button
            type="button"
            className={`seg${filter === 'unread' ? ' seg--on' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
            <span className="seg__count">{unread.length}</span>
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="bell"
          title={filter === 'unread' ? 'Nothing unread' : 'No notifications'}
          text={
            filter === 'unread'
              ? 'You are up to date.'
              : 'Rota changes, messages and reminders will appear here.'
          }
        />
      ) : (
        groups.map(([day, list]) => (
          <section key={day} className="notif-group">
            <div className="notif-group__head">
              <span className="notif-group__day">{day}</span>
              <span className="notif-group__count">{list.length}</span>
            </div>

            <div className="notif-list">
              {list.map((n) => {
                const kind = KINDS[n.type] ?? fallback;
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`ncard${n.read ? '' : ' ncard--unread'}`}
                    onClick={() => open(n)}
                  >
                    <span className={`ncard__icon ncard__icon--${kind.tone}`}>
                      <Icon name={kind.icon} size={16} />
                    </span>

                    <span className="ncard__body">
                      <span className="ncard__top">
                        <span className="ncard__kind">{kind.label}</span>
                        <span className="ncard__time">{formatTime(n.at)}</span>
                      </span>
                      <span className="ncard__title">{n.title}</span>
                      {n.text && <span className="ncard__text">{n.text}</span>}
                    </span>

                    {!n.read && <span className="ncard__dot" aria-label="Unread" />}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
