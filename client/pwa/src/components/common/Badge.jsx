// Small status pill: Upcoming / Completed / In progress etc.
export default function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
