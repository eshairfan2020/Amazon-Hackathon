export default function EmptyState({ title, hint, children }) {
  return (
    <div className="card text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {children && <div className="mt-3 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
