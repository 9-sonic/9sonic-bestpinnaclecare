export default function Spinner({ fullscreen = false, label = 'Loading' }) {
  return (
    <div className={`spinner${fullscreen ? ' spinner--fullscreen' : ''}`} role="status">
      <span className="spinner__dot" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
