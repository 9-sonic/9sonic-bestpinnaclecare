import Icon from '../common/Icon.jsx';
import Avatar from '../common/Avatar.jsx';
import { formatTimeRange, formatDayLabel } from '../../utils/format.js';
import { tapFeedback } from '../../utils/haptics.js';

// Minutes as a readable duration.
function workedLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const LABELS = {
  upcoming: 'Upcoming',
  active: 'On shift',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

// A visit in a list.
//
// One component for every list of visits in the app: Home, Shifts, and the
// switcher on the clock screen. That is deliberate. The clock screen used to
// carry its own copy of this markup, the shared card changed, and the copy
// silently collapsed into an unreadable strip. There is a test for it now, but
// the real fix is not having a second copy to drift.
//
// Layout follows the Penpot board: the person leads, with the status opposite
// their name, then the time and day as one line beneath, then where and what
// the visit is for.
//
// This reverses an earlier pass that led with the time on the grounds that a
// carer scanning their day looks for a time first. Both readings are
// defensible; the board is the tie-breaker for now. If that rationale still
// holds, it is Athaliah's call to make on the board rather than in here.
//
// `compact` hides the address, note and actions, for places that list visits
// only so one can be picked.
// `actions` adds the route and details buttons.
export default function ShiftCard({
  shift,
  onSelect,
  index,
  compact = false,
  selected = false,
  actions = false,
  onRoute,
  onDetails,
}) {
  const done = shift.status === 'completed';
  // The whole card is clickable only when it has no buttons of its own.
  // Nesting a button inside a clickable card means one tap fires two things.
  const clickable = !!onSelect && !actions;

  return (
    <article
      className={[
        'vcard',
        `vcard--${shift.status}`,
        compact && 'vcard--compact',
        selected && 'vcard--selected',
      ]
        .filter(Boolean)
        .join(' ')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-current={selected ? 'true' : undefined}
      onClick={() => {
        if (!clickable) return;
        tapFeedback();
        onSelect(shift);
      }}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(shift);
        }
      }}
    >
      <div className="vcard__head">
        <div className="vcard__avatar">
          {/* The board draws this at 40; 44 to sit with the roomier spacing.
              Avatar sizes itself with an inline style, so this has to be the
              prop — a stylesheet cannot win against it without !important,
              and reaching for that here would be fighting the component
              rather than configuring it. */}
          <Avatar name={shift.client} size={44} />
          {/* A finished visit is marked rather than dimmed: greying the whole
              card made it look broken instead of done. */}
          {done && (
            <span className="vcard__done" aria-hidden="true">
              <Icon name="check" size={11} strokeWidth={3} />
            </span>
          )}
        </div>

        <div className="vcard__id">
          <div className="vcard__topline">
            <h3 className="vcard__name">
              {typeof index === 'number' && <span className="vcard__index">{index}</span>}
              {shift.client}
            </h3>
            <span className={`badge badge--${shift.status}`}>
              {LABELS[shift.status] ?? shift.status}
            </span>
          </div>

          {/* Time and day read as one line, separated by a dot, at the same
              size and weight — the board treats them as a single fact about
              the visit rather than a heading with a subtitle. */}
          <p className="vcard__timing">
            <Icon name="clock" size={13} />
            <span className="vcard__range">
              {formatTimeRange(shift.startsAt, shift.endsAt)}
            </span>
            <span className="vcard__dot" aria-hidden="true">•</span>
            <span className="vcard__day">{formatDayLabel(shift.startsAt)}</span>
          </p>
        </div>
      </div>

      {!compact && (
        <>
          <p className="vcard__addr">
            <Icon name="pin" size={13} />
            {shift.address}
          </p>

          {/* Once a visit is done the hours worked matter more than the note. */}
          {done && shift.workedMinutes ? (
            <span className="vcard__worked">
              <Icon name="check" size={12} />
              {workedLabel(shift.workedMinutes)} recorded
            </span>
          ) : (
            shift.note && <p className="vcard__note">{shift.note}</p>
          )}

          {shift.needsAttention && (
            <span className="vcard__flag">
              <Icon name="alert" size={12} />
              Needs attention
            </span>
          )}

          {actions && (
            <div className="vcard__actions">
              {shift.status === 'upcoming' ? (
                <button
                  type="button"
                  className="vcard__go"
                  onClick={() => { tapFeedback(); onRoute?.(shift); }}
                >
                  Start Route
                </button>
              ) : (
                <button
                  type="button"
                  className="vcard__go vcard__go--quiet"
                  onClick={() => { tapFeedback(); onDetails?.(shift); }}
                >
                  View Visit
                </button>
              )}
              <button
                type="button"
                className="vcard__details"
                onClick={() => { tapFeedback(); onDetails?.(shift); }}
              >
                Details
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
