const MAP = {
  on_track: ['On track', '✓', 'border-success/50 text-success'],
  at_risk: ['At risk', '⚠', 'border-highlight/50 text-highlight'],
  overdue: ['Overdue', '✕', 'border-danger/50 text-danger'],
  completed: ['Completed', '●', 'border-success/50 text-success'],
  pending: ['Pending', '…', 'border-warning/50 text-warning'],
  approved: ['Approved', '✓', 'border-success/50 text-success'],
  rejected: ['Rejected', '✕', 'border-danger/50 text-danger'],
  failed: ['Failed', '!', 'border-danger/50 text-danger'],
  success: ['Success', '✓', 'border-success/50 text-success'],
};

export default function StatusBadge({ status }) {
  const [label, icon, tone] = MAP[status] || [status, '•', 'border-line text-muted'];
  return <span className={`pill ${tone}`}><span aria-hidden="true">{icon}</span>{label}</span>;
}
