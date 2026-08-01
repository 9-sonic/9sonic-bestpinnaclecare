import { useMemo, useState } from 'react';
import Icon from '../common/Icon.jsx';
import { selectFeedback, tapFeedback } from '../../utils/haptics.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const sameDay = (a, b) => a && b && new Date(a).toDateString() === new Date(b).toDateString();
const keyOf = (d) => new Date(d).toDateString();

// Month grid for picking a day of the rota.
//
// Design notes, because the previous version read as a spreadsheet:
//
//  - No card around it. The grid sits on the page background, which removes a
//    border competing with the selection state and lets the days breathe.
//  - Load is shown as a bar under the number rather than dots. Dots stop being
//    countable past two or three; a bar that grows says "busier" at a glance.
//  - Today is a ring, the selection is a fill. They can coexist, which the dot
//    version could not show.
//  - Weekends are tinted so a week reads as a shape rather than seven columns.
export default function Calendar({ selected, onSelect, markedDates = [] }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(selected ?? Date.now());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const counts = useMemo(() => {
    const map = new Map();
    markedDates.forEach((d) => {
      const k = keyOf(d);
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return map;
  }, [markedDates]);

  const busiest = useMemo(() => Math.max(1, ...counts.values()), [counts]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    // Monday-first offset; JS getDay() is Sunday-first.
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
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

  const today = new Date();
  const isThisMonth =
    cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();

  const monthTotal = useMemo(
    () =>
      cells
        .filter((c) => !c.outside)
        .reduce((sum, c) => sum + (counts.get(keyOf(c.date)) ?? 0), 0),
    [cells, counts]
  );

  const move = (delta) => {
    tapFeedback();
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  function pick(cell) {
    selectFeedback();
    if (cell.outside) setCursor(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    onSelect?.(cell.date);
  }

  return (
    <section className="cal" aria-label="Shift calendar">
      <header className="cal__head">
        <div className="cal__title">
          <span className="cal__month">
            {cursor.toLocaleDateString('en-GB', { month: 'long' })}
          </span>
          <span className="cal__year">{cursor.getFullYear()}</span>
          {monthTotal > 0 && (
            <span className="cal__total">
              {monthTotal} {monthTotal === 1 ? 'visit' : 'visits'}
            </span>
          )}
        </div>

        <div className="cal__nav">
          {!isThisMonth && (
            <button
              type="button"
              className="cal__today"
              onClick={() => {
                tapFeedback();
                setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                onSelect?.(today);
              }}
            >
              Today
            </button>
          )}
          <button
            type="button"
            className="cal__arrow"
            onClick={() => move(-1)}
            aria-label="Previous month"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            type="button"
            className="cal__arrow"
            onClick={() => move(1)}
            aria-label="Next month"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </header>

      <div className="cal__grid" role="grid">
        {DOW.map((d) => (
          <span key={d} className="cal__dow" aria-hidden="true">
            {d.charAt(0)}
          </span>
        ))}

        {cells.map((cell) => {
          const count = counts.get(keyOf(cell.date)) ?? 0;
          const isSelected = sameDay(cell.date, selected);
          const isToday = sameDay(cell.date, today);
          const weekend = [0, 6].includes(cell.date.getDay());

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
              })}${count ? `, ${count} visit${count > 1 ? 's' : ''}` : ', no visits'}`}
              className={[
                'cal__day',
                cell.outside && 'cal__day--outside',
                weekend && 'cal__day--weekend',
                isToday && 'cal__day--today',
                isSelected && 'cal__day--selected',
                count > 0 && 'cal__day--has',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => pick(cell)}
            >
              <span className="cal__num">{cell.date.getDate()}</span>
              <span className="cal__load" aria-hidden="true">
                {count > 0 && (
                  <span
                    className="cal__load-fill"
                    style={{ width: `${Math.max(28, (count / busiest) * 100)}%` }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
