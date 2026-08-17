import Icon from './Icon.jsx';
import { s } from '../../lib/ui.jsx';

// A small ⓘ icon that reveals a short explanation on hover/focus. Used next to
// action buttons so a control is self-documenting — e.g. "Add visit ⓘ" explains
// what the button does without a tour needing to open and drive the modal.
//
// Pure CSS hover (see .info-hint in admin.css), so it works without any state and
// never mispositions. Keyboard-accessible: it's focusable and shows on focus.
export default function InfoHint({ text, label = 'More info' }) {
  return (
    <span className="info-hint" tabIndex={0} role="note" aria-label={label}
      style={s('position:relative;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;color:var(--d-muted);cursor:help;flex:none;outline:none')}>
      <Icon name="info" size={14} />
      <span className="info-hint__bubble"
        style={s('position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:max-content;max-width:240px;background:var(--d-ink);color:var(--d-card);font-size:12px;font-weight:600;line-height:1.45;padding:9px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.28);z-index:120;text-align:left;pointer-events:none')}>
        {text}
      </span>
    </span>
  );
}
