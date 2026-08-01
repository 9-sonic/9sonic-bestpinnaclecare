// Rounded surface used throughout the app. Render it as a button when the whole
// card is tappable, so keyboard and screen reader users get real button
// semantics instead of a click handler on a div.
export default function Card({ as: Tag = 'div', className = '', padded = true, ...rest }) {
  const isButton = Tag === 'button';
  return (
    <Tag
      className={`card${padded ? ' card--padded' : ''}${isButton ? ' card--button' : ''} ${className}`.trim()}
      {...(isButton ? { type: 'button' } : null)}
      {...rest}
    />
  );
}
