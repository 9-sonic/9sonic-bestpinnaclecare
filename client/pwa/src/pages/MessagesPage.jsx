import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listThreads } from '../api/messages.js';
import { subscribeInbox } from '../api/cable.js';
import { useAuth } from '../hooks/useAuth.js';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Avatar from '../components/common/Avatar.jsx';
import Icon from '../components/common/Icon.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { SkeletonList } from '../components/common/Skeleton.jsx';
import { formatChatTime } from '../utils/format.js';

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    listThreads(user)
      .then((data) => active && setThreads(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Live: refetch the thread list whenever any message arrives over the socket.
  useEffect(() => {
    const off = subscribeInbox((payload) => {
      if (payload?.type === 'message') listThreads(user).then(setThreads).catch(() => { /* ignore */ });
    });
    return off;
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.name.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q)
    );
  }, [threads, query]);

  const unreadTotal = threads.reduce((sum, t) => sum + (t.unread ?? 0), 0);

  // The design groups threads by what they are, which is how a carer looks for
  // one: the office is a different kind of conversation from a client thread
  // that several carers can read. Falls back to Direct when the API has not
  // told us, so an unclassified thread is still reachable rather than dropped.
  const groups = useMemo(() => {
    const order = [
      { key: 'direct', label: 'Direct' },
      { key: 'channel', label: 'Channels' },
      { key: 'client', label: 'Client threads' },
    ];
    return order
      .map((g) => ({
        ...g,
        items: filtered.filter((t) => (t.kind ?? 'direct') === g.key),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <div className="page--flush">
      <ScreenHeader
        large
        title="Messages"
        action={
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => navigate('/notifications')}
          >
            <span className="bell-wrap">
              <Icon name="bell" size={21} />
              {unreadTotal > 0 && <span className="bell-wrap__dot" />}
            </span>
          </button>
        }
      />

      <div className="search-bar">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search chats"
        />
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="chat"
          title={query ? 'No matches' : 'No messages yet'}
          text={
            query
              ? 'Try a different name or keyword.'
              : 'Messages from your manager and team will appear here.'
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="thread-group">
            <p className="thread-group__label">{group.label}</p>
            <div className="thread-list">
              {group.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`thread-row${t.unread ? ' thread-row--unread' : ''}`}
                  onClick={() => navigate(`/messages/${t.id}`)}
                >
                  {/* Varied here on purpose: a chat list puts many different
                      people in one column, and the colour is what lets a
                      carer find a thread without reading every name. */}
                  <Avatar name={t.name} size={44} varied />
                  <span className="thread-row__body">
                    <span className="thread-row__top">
                      <span className="thread-row__name">{t.name}</span>
                      {t.pinned && (
                        <Icon name="pin" size={12} className="thread-row__pin" />
                      )}
                    </span>
                    {/* What the thread is, under its name. Without it a
                        channel and a person look identical in a list. */}
                    {t.subtitle && (
                      <span className="thread-row__sub">{t.subtitle}</span>
                    )}
                    <span className="thread-row__preview">{t.preview}</span>
                  </span>
                  <span className="thread-row__side">
                    <span className="thread-row__time">{formatChatTime(t.lastAt)}</span>
                    {t.unread > 0 && (
                      <span className="thread-row__count">{t.unread}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
