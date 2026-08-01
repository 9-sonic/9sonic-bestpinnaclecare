// Status pill. Tone maps to a lifecycle state, so colour carries meaning
// consistently across the board, the rota and the exceptions queue.
export default function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
