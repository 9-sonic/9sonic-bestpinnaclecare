// A single headline number. Tone is used sparingly: only counts that need
// someone to do something are coloured, so colour keeps its meaning.
export default function StatTile({ label, value, tone = 'neutral', onClick, hint }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`tile tile--${tone}`} onClick={onClick}>
      <span className="tile__value">{value}</span>
      <span className="tile__label">{label}</span>
      {hint && <span className="tile__hint">{hint}</span>}
    </Tag>
  );
}
