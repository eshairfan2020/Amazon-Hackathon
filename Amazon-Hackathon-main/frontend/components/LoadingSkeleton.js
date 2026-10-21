export default function LoadingSkeleton({ rows = 3 }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />)}
    </div>
  );
}
