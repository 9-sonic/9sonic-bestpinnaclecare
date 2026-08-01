export default function Card({ as: Tag = 'div', className = '', padded = true, ...rest }) {
  return <Tag className={`card${padded ? ' card--padded' : ''} ${className}`.trim()} {...rest} />;
}
