export default function MetricCard({ label, value, hint, tone = 'text-ink' }) {
  return (
    <div className="card">
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}
