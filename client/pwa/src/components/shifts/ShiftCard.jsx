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
};

// A visit in a list.
//
// The revamped design drops the time rail and leads with the person: a tinted
// initials avatar, then the name, the time, the address and the visit note,
// with a status pill in the corner. Reading down a column of faces is how a
// carer actually scans their day.
//
// `compact` keeps the same shape but hides the address and note, for places
// that list visits only so one can be chosen.
export default function ShiftCard({ shift, onSelect, index, compact = false, selected = false }) {
  return (
    <article
      className={[
        'scard',
        `scard--${shift.status}`,
        compact && 'scard--compact',
        selected && 'scard--selected',
      ]
        .filter(Boolean)
        .join(' ')}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-current={selected ? 'true' : undefined}
      onClick={() => {
        if (!onSelect) return;
        tapFeedback();
        onSelect(shift);
      }}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(shift);
        }
      }}
    >
      <div className="scard__top">
        <Avatar name={shift.client} size={44} />
        {/* A finished visit is marked rather than dimmed: greying the whole
            card made it look broken instead of done. */}
        {shift.status === 'completed' && (
          <span className="scard__done" aria-hidden="true">
            <Icon name="check" size={12} strokeWidth={3} />
          </span>
        )}

        <div className="grow">
          <div className="scard__name">
            {typeof index === 'number' && <span className="scard__index">{index}</span>}
            {shift.client}
          </div>

          <div className="scard__when">
            <Icon name="clock" size={13} />
            <span>{formatTimeRange(shift.startsAt, shift.endsAt)}</span>
            <span className="scard__sep" aria-hidden="true">•</span>
            <span>{formatDayLabel(shift.startsAt)}</span>
          </div>
        </div>

        <span className={`badge badge--${shift.status}`}>
          {LABELS[shift.status] ?? shift.status}
        </span>
      </div>

      {!compact && (
        <>
          <div className="scard__where">
            <Icon name="pin" size={13} />
            {shift.address}
          </div>

          {/* Once a visit is done the hours worked matter more than the note. */}
          {shift.status === 'completed' && shift.workedMinutes ? (
            <span className="scard__worked">
              <Icon name="check" size={12} />
              {workedLabel(shift.workedMinutes)} recorded
            </span>
          ) : (
            shift.note && <p className="scard__note">{shift.note}</p>
          )}

          {shift.needsAttention && (
            <span className="scard__flag">
              <Icon name="alert" size={12} />
              Needs attention
            </span>
          )}
        </>
      )}
    </article>
  );
}
