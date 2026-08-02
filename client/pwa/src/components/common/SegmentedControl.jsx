import { selectFeedback } from '../../utils/haptics.js';

// Pill tab switcher (Hours / Visits / Miles on the Overview screen).
export default function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented__item${active ? ' segmented__item--active' : ''}`}
            onClick={() => { selectFeedback(); onChange(opt.value); }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
