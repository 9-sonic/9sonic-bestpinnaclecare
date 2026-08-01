import Icon from './Icon.jsx';
import Button from './Button.jsx';

// Friendly placeholder for lists with nothing in them, better than a bare
// "no data" line, and gives the carer somewhere to go next.
export default function EmptyState({ icon = 'info', title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={26} />
      </span>
      <p className="empty-state__title">{title}</p>
      {text && <p className="empty-state__text">{text}</p>}
      {action && (
        <Button size="sm" variant="white" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}
