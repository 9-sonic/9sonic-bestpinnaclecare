import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyRequests } from '../api/requests.js';
import { useInboxNotifications } from '../hooks/useInboxNotifications.js';
import ScreenHeader from '../components/common/ScreenHeader.jsx';
import Icon from '../components/common/Icon.jsx';
import Badge from '../components/common/Badge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { SkeletonList } from '../components/common/Skeleton.jsx';
import { formatDayLabel, formatTime } from '../utils/format.js';

// Everything the carer has asked the office — cover, swaps, overtime, leave —
// with the office's decision alongside it.
//
// The admin console approves and declines these from its Requests queue, and
// its reply ("decision_note") is meant for the carer: without this screen the
// answer was written into the record and never shown to the person it was for.

const KINDS = {
  swap: { icon: 'sync', tone: 'info', label: 'Shift swap' },
  drop: { icon: 'users', tone: 'warn', label: 'Cover' },
  overtime: { icon: 'clock', tone: 'teal', label: 'Overtime' },
  availability: { icon: 'calendar', tone: 'purple', label: 'Availability' },
  leave: { icon: 'coffee', tone: 'grey', label: 'Leave' },
  clock_assistance: { icon: 'alert', tone: 'danger', label: 'Clock-in help' },
};

const STATES = {
  pending: { tone: 'warning', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  declined: { tone: 'danger', label: 'Declined' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

const fallbackKind = { icon: 'file', tone: 'grey', label: 'Request' };

export default function RequestsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    listMyRequests()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A decision lands as a notification; refetch rather than patching the row,
  // so the request and its reply always read the way the office saved them.
  useInboxNotifications(refresh);

  const pendingCount = items.filter((r) => r.state === 'pending').length;

  return (
    <div className="page--flush">
      <ScreenHeader title="My requests" back onBack={() => navigate('/profile')} />

      <div className="notif-head">
        <span className="notif-head__title">
          {pendingCount > 0 ? `${pendingCount} awaiting the office` : 'Nothing awaiting the office'}
        </span>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="send"
          title="No requests yet"
          text="When you ask for cover, a swap, overtime or leave, the request and the office's reply appear here."
        />
      ) : (
        <div className="notif-list">
          {items.map((r) => {
            const kind = KINDS[r.kind] ?? fallbackKind;
            const state = STATES[r.state] ?? STATES.pending;
            return (
              <div key={r.id} className="ncard">
                <span className={`ncard__icon ncard__icon--${kind.tone}`}>
                  <Icon name={kind.icon} size={16} />
                </span>

                <span className="ncard__body">
                  <span className="ncard__top">
                    <span className="ncard__kind">{kind.label}</span>
                    <span className="ncard__time">
                      {formatDayLabel(r.created_at)} · {formatTime(r.created_at)}
                    </span>
                  </span>
                  <span className="ncard__title">{r.summary}</span>
                  {r.detail && <span className="ncard__text">{r.detail}</span>}
                  <span className="ncard__top">
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </span>
                  {r.decision_note && (
                    <span className="ncard__text">
                      {r.decided_by ? `${r.decided_by}: ` : 'Office: '}
                      {r.decision_note}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
