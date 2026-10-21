import StatusBadge from './StatusBadge';
import { fmt } from '@/lib/format';

export default function ActivityFeed({ events }) {
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <code className="font-semibold">{e.tool}</code>
            <StatusBadge status={e.status} />
          </div>
          <p className="text-sm text-muted">{fmt(e.at)} · Task {e.taskId}</p>
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer text-muted">Details</summary>
            <p className="text-muted">Input: {e.inputSummary}</p>
            <p className="text-muted">Outcome: {e.outcome}</p>
          </details>
        </li>
      ))}
    </ol>
  );
}
