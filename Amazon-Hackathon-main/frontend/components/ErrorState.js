export default function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="card border-danger/60">
      <p className="font-semibold text-danger">Something went wrong</p>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && <button className="btn mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}
