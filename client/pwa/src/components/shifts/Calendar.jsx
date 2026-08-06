import { useMemo, useState } from 'react';
import Icon from '../common/Icon.jsx';
import { selectFeedback } from '../../utils/haptics.js';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const sameDay = (a, b) => a && b && new Date(a).toDateString() === new Date(b).toDateString();
const keyOf = (d) => new Date(d).toDateString();

// Month grid.
//
// Sunday first and borderless: a plain white card, muted days from the
// neighbouring months, and each day carrying what happened on it.
//
// The colours are the legend's colours, and only those three. A day that went
// wrong is filled in its colour so it is findable while scrolling the month;
// an ordinary day of care visits gets a dot, because filling every working day
// would leave nothing standing out. Selection is the brand colour and always
// wins the fill, since the carer chose it.
export default function Calendar({ selected, onSelect, markedDates = [], onMonthChange }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(selected ?? Date.now());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // date -> { count, tone }
  //
  // A day can hold several visits with different outcomes. The worst one wins
  // the day's colour: a missed visit is the thing worth spotting from a
  // month away, and it should not be hidden behind three that went fine.
  const marks = useMemo(() => {
    const RANK = { care: 0, late: 1, missed: 2 };
    const map = new Map();
    markedDates.forEach((entry) => {
      const date = entry?.date ?? entry;
      const tone = entry?.tone ?? 'care';
      const k = keyOf(date);
      const existing = map.get(k);
      const worst =
        existing && RANK[existing.tone] >= RANK[tone] ? existing.tone : tone;
      map.set(k, { count: (existing?.count ?? 0) + 1, tone: worst });
    });
    return map;
  }, [markedDates]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const lead = new Date(year, month, 1).getDay();
    const daysThis = new Date(year, month + 1, 0).getDate();
    const daysPrev = new Date(year, month, 0).getDate();

    const out = [];
    for (let i = lead - 1; i >= 0; i -= 1) {
      out.push({ date: new Date(year, month - 1, daysPrev - i), outside: true });
    }
    for (let d = 1; d <= daysThis; d += 1) {
      out.push({ date: new Date(year, month, d), outside: false });
    }
    while (out.length % 7 !== 0) {
      const next = out.length - lead - daysThis + 1;
      out.push({ date: new Date(year, month + 1, next), outside: true });
    }
    return out;
  }, [cursor]);

  function move(delta) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    onMonthChange?.(next);
  }

  const today = new Date();

  function pick(cell) {
    selectFeedback();
    if (cell.outside) {
      const next = new Date(cell.date.getFullYear(), cell.date.getMonth(), 1);
      setCursor(next);
      onMonthChange?.(next);
    }
    onSelect?.(cell.date);
  }

  return (
    <>
      <div className="page-title">
        <span className="page-title__text">
          {cursor.toLocaleDateString('en-GB', { month: 'long' })} {cursor.getFullYear()}
        </span>
        <span className="cal__nav">
          <button type="button" className="round-btn" onClick={() => move(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" size={17} />
          </button>
          <button type="button" className="round-btn" onClick={() => move(1)} aria-label="Next month">
            <Icon name="chevronRight" size={17} />
          </button>
        </span>
      </div>

      <div className="cal">
        <div className="cal__grid" role="grid">
          {DOW.map((d, i) => (
            <span key={`${d}${i}`} className="cal__dow" aria-hidden="true">
              {d}
            </span>
          ))}

          {cells.map((cell) => {
            const mark = marks.get(keyOf(cell.date));
            const isSelected = sameDay(cell.date, selected);
            const isToday = sameDay(cell.date, today);

            return (
              <button
                key={cell.date.toISOString()}
                type="button"
                aria-current={isToday ? 'date' : undefined}
                aria-pressed={isSelected}
                aria-label={`${cell.date.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}${mark ? `, ${mark.count} visit${mark.count > 1 ? 's' : ''}` : ', no visits'}`}
                className={[
                  'cal__day',
                  cell.outside && 'cal__day--outside',
                  isToday && 'cal__day--today',
                  isSelected && 'cal__day--selected',
                  // Filled only when something went wrong; an ordinary day of
                  // care visits shows a dot instead.
                  !isSelected && mark && mark.tone !== 'care' && `cal__day--${mark.tone}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => pick(cell)}
              >
                <span className="cal__num">{cell.date.getDate()}</span>
                {mark && <span className={`cal__dot cal__dot--${mark.tone}`} aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {/* The key to the dots, inside the card as in the design. Without it
            the coloured dots are decoration nobody can read. */}
        <div className="cal-legend">
          <span className="cal-legend__item">
            <span className="cal-legend__swatch cal-legend__swatch--care" />
            Care visit
          </span>
          <span className="cal-legend__item">
            <span className="cal-legend__swatch cal-legend__swatch--missed" />
            Missed visit
          </span>
          <span className="cal-legend__item">
            <span className="cal-legend__swatch cal-legend__swatch--late" />
            Late arrival
          </span>
        </div>
      </div>
    </>
  );
}
