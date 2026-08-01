// Loading indicator. `fullscreen` centres it in the viewport.
export default function Spinner({ fullscreen = false, label }) {
  return (
    <div className={fullscreen ? 'spinner spinner--fullscreen' : 'spinner'} role="status">
      <span className="spinner__dot" aria-hidden="true" />
      {label && <span>{label}</span>}
      <span className="sr-only">Loading</span>
    </div>
  );
}
