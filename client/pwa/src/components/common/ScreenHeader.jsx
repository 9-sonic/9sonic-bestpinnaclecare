import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

// Standard in-app screen header: optional back arrow, centred title, optional
// trailing action (the "⋮" / edit icons in the designs).
export default function ScreenHeader({ title, back = false, onBack, action, large = false }) {
  const navigate = useNavigate();
  if (large) {
    return (
      <header className="screen-header screen-header--large">
        <h1 className="screen-header__title-large">{title}</h1>
        {action}
      </header>
    );
  }
  return (
    <header className="screen-header">
      <span className="screen-header__slot">
        {back && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Go back"
            onClick={onBack ?? (() => navigate(-1))}
          >
            <Icon name="back" size={20} />
          </button>
        )}
      </span>
      <h1 className="screen-header__title">{title}</h1>
      <span className="screen-header__slot screen-header__slot--end">{action}</span>
    </header>
  );
}
