import { tapFeedback } from '../../utils/haptics.js';

// The app's button.
//
// Tactile feedback is built in rather than left to each caller, so a tap feels
// the same everywhere. `loading` swaps the label for a spinner and blocks
// further presses, which is what stops a carer double-submitting a clock event
// on a slow connection.
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  pill = false,
  loading = false,
  type = 'button',
  className = '',
  onClick,
  disabled,
  haptic = true,
  ...rest
}) {
  function handleClick(event) {
    if (loading || disabled) return;
    if (haptic) tapFeedback();
    onClick?.(event);
  }

  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''}${pill ? ' btn--pill' : ''} ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
