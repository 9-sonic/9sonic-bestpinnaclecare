// Shimmer placeholders. These mirror the shape of the real content so the
// layout does not jump when data arrives.

export function Skeleton({ w = '100%', h = 12, r = 'var(--radius-sm)', className = '', style }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width: w, height: h, borderRadius: r, ...style }}
      aria-hidden="true"
    />
  );
}

// Matches ShiftCard: avatar, two lines of text, status pill, then a note line.
export function SkeletonCard() {
  return (
    <div className="card card--padded skeleton-card">
      <div className="skeleton-card__row">
        <Skeleton w={42} h={42} r="50%" />
        <div className="skeleton-card__lines">
          <Skeleton w="58%" h={13} />
          <Skeleton w="38%" h={11} />
        </div>
        <Skeleton w={62} h={20} r="var(--radius-pill)" />
      </div>
      <Skeleton w="85%" h={11} />
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="skeleton-list" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default Skeleton;
