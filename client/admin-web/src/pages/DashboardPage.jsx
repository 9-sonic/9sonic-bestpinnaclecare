import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard, getLiveBoard } from '../api/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import StatTile from '../components/common/StatTile.jsx';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import { LIFECYCLE_LABELS, LIFECYCLE_TONE, ATTENTION_ORDER, formatTime, fullName } from '../api/format.js';
import { useAuth } from '../context/AuthContext.jsx';

// The office landing screen: what needs a person to do something, first.
export default function DashboardPage() {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getDashboard(), getLiveBoard()])
      .then(([d, b]) => {
        if (!active) return;
        setData(d);
        setBoard(b);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Spinner fullscreen />;

  const counts = data?.today_counts ?? {};
  const needsAttention = ATTENTION_ORDER.reduce((sum, k) => sum + (counts[k] ?? 0), 0);
  const onShift = counts.in_progress ?? 0;
  const done = counts.completed ?? 0;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const attentionRows = (board?.assignments ?? []).filter((a) =>
    ATTENTION_ORDER.includes(a.lifecycle_state)
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${admin?.first_name ?? ''}`}
        subtitle={new Date().toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        actions={
          <Button variant="white" onClick={() => navigate('/board')}>
            <Icon name="target" size={16} />
            Live board
          </Button>
        }
      />

      <div className="tiles">
        <StatTile
          label="Need attention"
          value={needsAttention}
          tone={needsAttention > 0 ? 'danger' : 'neutral'}
          onClick={() => navigate('/exceptions')}
          hint={needsAttention > 0 ? 'Late, missed or awaiting review' : 'Nothing outstanding'}
        />
        <StatTile label="On shift now" value={onShift} tone={onShift > 0 ? 'active' : 'neutral'} onClick={() => navigate('/board')} />
        <StatTile label="Completed today" value={done} hint={total > 0 ? `of ${total} visits` : undefined} />
        <StatTile
          label="Unassigned"
          value={data?.unassigned_upcoming ?? 0}
          tone={(data?.unassigned_upcoming ?? 0) > 0 ? 'warn' : 'neutral'}
          onClick={() => navigate('/rota')}
          hint="Published, next 7 days"
        />
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Needs a decision</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/exceptions')}>
            All exceptions
          </Button>
        </div>

        {attentionRows.length === 0 ? (
          <Card className="all-clear">
            <span className="all-clear__icon">
              <Icon name="check" size={20} />
            </span>
            <div>
              <p className="all-clear__title">Nothing outstanding</p>
              <p className="all-clear__text">
                Every visit today is either running to plan or already finished.
              </p>
            </div>
          </Card>
        ) : (
          <Card padded={false}>
            {attentionRows.map((a) => (
              <button
                key={a.id}
                type="button"
                className="attn-row"
                onClick={() => navigate('/exceptions')}
              >
                <Badge tone={LIFECYCLE_TONE[a.lifecycle_state]}>
                  {LIFECYCLE_LABELS[a.lifecycle_state]}
                </Badge>
                <span className="attn-row__who">
                  <span className="attn-row__name">{fullName(a.visit?.service_user)}</span>
                  <span className="attn-row__meta">
                    Scheduled {formatTime(a.visit?.scheduled_start)}
                  </span>
                </span>
                <Icon name="chevronRight" size={16} />
              </button>
            ))}
          </Card>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Quick actions</h2>
        </div>
        <div className="quick">
          <button type="button" className="quick__item" onClick={() => navigate('/rota')}>
            <Icon name="calendar" size={18} />
            Build the rota
          </button>
          <button type="button" className="quick__item" onClick={() => navigate('/employees')}>
            <Icon name="users" size={18} />
            Staff
          </button>
          <button type="button" className="quick__item" onClick={() => navigate('/timesheets')}>
            <Icon name="wallet" size={18} />
            Approve hours
          </button>
          <button type="button" className="quick__item" onClick={() => navigate('/service-users')}>
            <Icon name="user" size={18} />
            People we support
          </button>
        </div>
      </section>
    </>
  );
}
