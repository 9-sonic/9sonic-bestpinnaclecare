import { useCallback, useEffect, useState } from 'react';
import { getLiveBoard } from '../api/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import DataTable from '../components/common/DataTable.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_TONE,
  ATTENTION_ORDER,
  formatTime,
  formatTimeRange,
  fullName,
  minutesToHours,
} from '../api/format.js';

// Today, every visit, with its live state.
//
// Refreshes on a timer because the states change on the server as time passes,
// not because anyone clicked. Sixty seconds is frequent enough for a board on a
// wall and light enough not to hammer the API.
const REFRESH_MS = 60000;

export default function LiveBoardPage() {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    const b = await getLiveBoard();
    setBoard(b);
    setUpdatedAt(new Date());
    return b;
  }, []);

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);

  if (loading) return <Spinner fullscreen />;

  const all = board?.assignments ?? [];
  const rows =
    filter === 'attention'
      ? all.filter((a) => ATTENTION_ORDER.includes(a.lifecycle_state))
      : filter === 'active'
        ? all.filter((a) => a.lifecycle_state === 'in_progress')
        : all;

  const counts = board?.counts ?? {};
  const attention = ATTENTION_ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);

  const columns = [
    {
      key: 'time',
      header: 'Scheduled',
      width: '150px',
      render: (a) => (
        <span className="mono">{formatTimeRange(a.visit?.scheduled_start, a.visit?.scheduled_end)}</span>
      ),
    },
    {
      key: 'person',
      header: 'Person',
      render: (a) => (
        <span className="cell-stack">
          <b>{fullName(a.visit?.service_user)}</b>
          <span className="cell-sub">{a.visit?.service_user?.address_line1}</span>
        </span>
      ),
    },
    {
      key: 'carer',
      header: 'Carer',
      render: (a) => a.employee ? fullName(a.employee) : <span className="cell-sub">Unassigned</span>,
    },
    {
      key: 'actual',
      header: 'Actual',
      width: '150px',
      render: (a) => (
        <span className="mono">
          {a.actual_start ? formatTime(a.actual_start) : '--:--'}
          {' to '}
          {a.actual_end ? formatTime(a.actual_end) : '--:--'}
        </span>
      ),
    },
    {
      key: 'worked',
      header: 'Worked',
      width: '90px',
      render: (a) => (a.worked_minutes != null ? minutesToHours(a.worked_minutes) : '-'),
    },
    {
      key: 'state',
      header: 'State',
      width: '130px',
      render: (a) => (
        <Badge tone={LIFECYCLE_TONE[a.lifecycle_state]}>
          {LIFECYCLE_LABELS[a.lifecycle_state] ?? a.lifecycle_state}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Live board"
        subtitle={
          updatedAt
            ? `Today, updated ${updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
            : 'Today'
        }
        actions={
          <Button variant="white" onClick={load}>
            <Icon name="refresh" size={16} />
            Refresh
          </Button>
        }
      />

      <div className="filters">
        <button
          type="button"
          className={`chip${filter === 'all' ? ' chip--on' : ''}`}
          onClick={() => setFilter('all')}
        >
          All {all.length}
        </button>
        <button
          type="button"
          className={`chip${filter === 'active' ? ' chip--on' : ''}`}
          onClick={() => setFilter('active')}
        >
          On shift {counts.in_progress ?? 0}
        </button>
        <button
          type="button"
          className={`chip${filter === 'attention' ? ' chip--on' : ''}${attention > 0 ? ' chip--alert' : ''}`}
          onClick={() => setFilter('attention')}
        >
          Need attention {attention}
        </button>
      </div>

      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={rows}
          empty={
            <EmptyState
              icon="calendar"
              title={filter === 'all' ? 'No visits today' : 'Nothing in this view'}
              text={
                filter === 'all'
                  ? 'Once visits are published for today they will appear here.'
                  : 'Try another filter.'
              }
            />
          }
        />
      </Card>
    </>
  );
}
