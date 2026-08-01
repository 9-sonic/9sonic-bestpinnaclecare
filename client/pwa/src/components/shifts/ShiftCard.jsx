import Card from '../common/Card.jsx';
import Icon from '../common/Icon.jsx';
import Avatar from '../common/Avatar.jsx';
import Badge from '../common/Badge.jsx';
import { formatTime } from '../../utils/format.js';
import { tapFeedback } from '../../utils/haptics.js';

const LABELS = {
  upcoming: 'Upcoming',
  active: 'On shift',
  completed: 'Completed',
};

// Rounded to the nearest five minutes: a visit is never scheduled to the
// minute, and "1h 30m" is easier to read than "1h 32m".
function duration(startsAt, endsAt) {
  const mins = Math.round((new Date(endsAt) - new Date(startsAt)) / 60000);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// A visit in a list.
//
// The time sits in its own column on the left so a day reads as a timeline:
// the eye follows one column of start times rather than hunting for the time
// inside each card. `index` puts a position number on the card when the list
// is ordered and a carer might refer to "my third visit".
//
// `compact` drops the address, note and flag, leaving the time and the name.
// It is for places that list visits as a way of choosing between them, such as
// the switcher on the clock screen, where the detail is noise.
//
// This component is the only thing allowed to render `.shift-card`. The clock
// screen previously hand-rolled its own copy of this markup, which then broke
// silently when the card became a two column grid. One component, one place to
// change it.
export default function ShiftCard({ shift, onSelect, index, compact = false, selected = false }) {
  const dur = duration(shift.startsAt, shift.endsAt);

  return (
    <Card
      className={[
        'shift-card',
        `shift-card--${shift.status}`,
        compact && 'shift-card--compact',
        selected && 'shift-card--selected',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => {
        tapFeedback();
        onSelect?.(shift);
      }}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-current={selected ? 'true' : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(shift);
        }
      }}
    >
      <div className="shift-card__rail">
        <span className="shift-card__start">{formatTime(shift.startsAt)}</span>
        <span className="shift-card__end">{formatTime(shift.endsAt)}</span>
        {dur && !compact && <span className="shift-card__dur">{dur}</span>}
      </div>

      <div className="shift-card__main">
        <div className="shift-card__row">
          <Avatar name={shift.client} size={compact ? 26 : 30} />
          <div className="grow">
            <div className="shift-card__name">{shift.client}</div>
            {compact && <div className="shift-card__sub">{shift.address.split(',')[0]}</div>}
          </div>
          {typeof index === 'number' && <span className="shift-card__index">{index}</span>}
          <Badge tone={shift.status}>{LABELS[shift.status] ?? shift.status}</Badge>
        </div>

        {!compact && (
          <>
            <div className="shift-card__addr">
              <Icon name="pin" size={12} />
              {shift.address}
            </div>

            {shift.note && <p className="shift-card__note">{shift.note}</p>}

            {shift.needsAttention && (
              <span className="shift-card__flag">
                <Icon name="alert" size={12} />
                Needs attention
              </span>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
