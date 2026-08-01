import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listVisits,
  listEmployees,
  assignEmployee,
  withdrawAssignment,
  publishVisit,
  generateVisits,
} from '../api/index.js';
import PageHeader from '../components/common/PageHeader.jsx';
import Card from '../components/common/Card.jsx';
import Badge from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Icon from '../components/common/Icon.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatTime, formatTimeRange, fullName, weekOf, isoDate } from '../api/format.js';

// The rota: a week of visits, grouped by day, with a carer against each one.
//
// Assigning is the job this screen exists for, so it is one click from any
// unassigned visit. The server runs soft validators (overlap, rest, weekly
// hours) and returns warnings rather than refusing. That is deliberate on their
// side and respected here: a coordinator covering a sick call at short notice
// often has to double book knowingly, and the system should inform them rather
// than block them.

function AssignDialog({ open, onClose, visit, employees, onAssigned }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = employees.filter((e) => e.active);
    if (!q) return list;
    return list.filter((e) =>
      `${e.full_name} ${e.employee_reference ?? ''}`.toLowerCase().includes(q)
    );
  }, [employees, query]);

  async function assign(employee) {
    setBusyId(employee.id);
    try {
      const res = await assignEmployee({ visitId: visit.id, employeeId: employee.id });
      const warnings = res.warnings ?? [];
      if (warnings.length > 0) {
        // Surfaced, not swallowed: the coordinator needs to know what they just
        // agreed to, even though the assignment went through.
        toast.warn(`${employee.first_name} assigned. ${warnings.join('. ')}`);
      } else {
        toast.success(`${employee.full_name} assigned`);
      }
      onAssigned();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not assign that carer');
    } finally {
      setBusyId(null);
    }
  }

  if (!visit) return null;

  return (
    <Modal open={open} onClose={onClose} title="Assign a carer">
      <div className="assign__visit">
        <span className="assign__who">{fullName(visit.service_user)}</span>
        <span className="assign__when">
          {formatTimeRange(visit.scheduled_start, visit.scheduled_end)}
          {', '}
          {new Date(visit.scheduled_start).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          })}
        </span>
        <span className="assign__where">{visit.service_user?.address_line1}</span>
      </div>

      <label className="field">
        <span className="field__label">Search staff</span>
        <input
          className="field__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or reference"
          autoFocus
        />
      </label>

      <div className="assign__list">
        {filtered.length === 0 ? (
          <p className="cell-sub">No staff match that search.</p>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="assign__row">
              <span className="assign__avatar">
                {e.first_name[0]}
                {e.last_name[0]}
              </span>
              <span className="assign__person">
                <b>{e.full_name}</b>
                <span className="cell-sub">
                  {e.role === 'senior_carer' ? 'Senior carer' : 'Carer'}
                  {e.employee_reference ? ` · ${e.employee_reference}` : ''}
                </span>
              </span>
              <Button size="sm" loading={busyId === e.id} onClick={() => assign(e)}>
                Assign
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

export default function RotaPage() {
  const toast = useToast();
  const { canManage } = useAuth();
  const [weekStart, setWeekStart] = useState(() => weekOf().monday);
  const [visits, setVisits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [generating, setGenerating] = useState(false);

  const range = useMemo(() => weekOf(weekStart), [weekStart]);

  const load = useCallback(async () => {
    const [v, e] = await Promise.all([
      listVisits({ from: range.from, to: range.to }),
      listEmployees(),
    ]);
    setVisits(v);
    setEmployees(e);
  }, [range.from, range.to]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(range.monday);
      d.setDate(d.getDate() + i);
      out.push({
        date: d,
        key: isoDate(d),
        visits: visits.filter(
          (v) => new Date(v.scheduled_start).toDateString() === d.toDateString()
        ),
      });
    }
    return out;
  }, [visits, range.monday]);

  const unassignedCount = visits.filter(
    (v) => (v.assignments ?? []).length < v.staff_required
  ).length;

  const move = (weeks) => {
    const d = new Date(range.monday);
    d.setDate(d.getDate() + weeks * 7);
    setWeekStart(d);
  };

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await generateVisits({ from: range.from, to: range.to });
      toast.success(`${res.created} visits generated from care packages`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not generate visits');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish(visit) {
    try {
      await publishVisit(visit.id);
      toast.success('Visit published, the carer can now see it');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not publish');
    }
  }

  async function handleWithdraw(assignment) {
    try {
      await withdrawAssignment(assignment.id);
      toast.info('Carer removed from that visit');
      await load();
    } catch (err) {
      toast.error(err.message || 'Could not remove');
    }
  }

  const weekLabel = `${range.monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${range.sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

  return (
    <>
      <PageHeader
        title="Rota"
        subtitle={`${weekLabel}. ${visits.length} visits, ${unassignedCount} without a carer.`}
        actions={
          canManage && (
            <Button variant="white" loading={generating} onClick={handleGenerate}>
              <Icon name="refresh" size={16} />
              Generate from care packages
            </Button>
          )
        }
      />

      <div className="weekbar">
        <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label="Previous week">
          <Icon name="chevronLeft" size={18} />
        </button>
        <span className="weekbar__label">{weekLabel}</span>
        <button type="button" className="icon-btn" onClick={() => move(1)} aria-label="Next week">
          <Icon name="chevronRight" size={18} />
        </button>
        <button type="button" className="chip" onClick={() => setWeekStart(weekOf().monday)}>
          This week
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : visits.length === 0 ? (
        <Card>
          <EmptyState
            icon="calendar"
            title="No visits this week"
            text="Generate them from the care packages, or add one by hand."
            action={
              canManage && (
                <Button loading={generating} onClick={handleGenerate}>
                  Generate from care packages
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="rota">
          {days.map((day) => (
            <section key={day.key} className="rota__day">
              <div className="rota__dayhead">
                <span className="rota__dayname">
                  {day.date.toLocaleDateString('en-GB', { weekday: 'long' })}
                </span>
                <span className="rota__daydate">
                  {day.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <span className="rota__daycount">
                  {day.visits.length === 0 ? 'No visits' : `${day.visits.length} visits`}
                </span>
              </div>

              {day.visits.length === 0 ? (
                <p className="rota__empty">Nothing scheduled.</p>
              ) : (
                <div className="rota__list">
                  {day.visits.map((v) => {
                    const assigned = v.assignments ?? [];
                    const short = assigned.length < v.staff_required;
                    return (
                      <Card key={v.id} className={`visit${short ? ' visit--short' : ''}`}>
                        <div className="visit__time">
                          <span className="mono">{formatTime(v.scheduled_start)}</span>
                          <span className="visit__dash" aria-hidden="true" />
                          <span className="mono cell-sub">{formatTime(v.scheduled_end)}</span>
                        </div>

                        <div className="visit__body">
                          <div className="visit__head">
                            <span className="visit__person">{fullName(v.service_user)}</span>
                            {v.status === 'draft' && <Badge tone="neutral">Draft</Badge>}
                            {short && <Badge tone="warn">Needs a carer</Badge>}
                          </div>
                          <span className="visit__addr">
                            <Icon name="pin" size={13} />
                            {v.service_user?.address_line1}, {v.service_user?.postcode}
                          </span>

                          {assigned.length > 0 && (
                            <div className="visit__carers">
                              {assigned.map((a) => (
                                <span key={a.id} className="carer-chip">
                                  <span className="carer-chip__avatar">
                                    {a.employee?.first_name?.[0]}
                                    {a.employee?.last_name?.[0]}
                                  </span>
                                  {fullName(a.employee)}
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={() => handleWithdraw(a)}
                                      aria-label={`Remove ${fullName(a.employee)}`}
                                    >
                                      <Icon name="close" size={12} />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {canManage && (
                          <div className="visit__actions">
                            {short && (
                              <Button size="sm" onClick={() => setAssigning(v)}>
                                <Icon name="plus" size={14} />
                                Assign
                              </Button>
                            )}
                            {v.status === 'draft' && (
                              <Button size="sm" variant="white" onClick={() => handlePublish(v)}>
                                Publish
                              </Button>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <AssignDialog
        open={!!assigning}
        onClose={() => setAssigning(null)}
        visit={assigning}
        employees={employees}
        onAssigned={load}
      />
    </>
  );
}
