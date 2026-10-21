import StatusBadge from './StatusBadge';
import { fmt } from '@/lib/format';

export default function TimelineView({ items, conflictIds }) {
  return (
    <ol className="ml-2 border-l-2 border-line pl-5">
      {items.map((i) => (
        <li key={`${i.kind}-${i.id}`} className="relative mb-4">
          <span className={`absolute -left-[1.7rem] top-1.5 h-3 w-3 rounded-full ${conflictIds.includes(i.id) ? 'bg-highlight' : i.kind === 'event' ? 'bg-muted' : 'bg-secondary'}`} />
          <p className="text-sm text-muted">{fmt(i.at)}</p>
          <p className="font-medium">
            {i.title} {i.kind === 'event' && <span className="pill border-warning/50 text-warning">Simulated event</span>}
            {i.kind === 'task' && <StatusBadge status={i.status} />}
            {conflictIds.includes(i.id) && <span className="pill ml-1 border-highlight/50 text-highlight">⚠ Conflict</span>}
          </p>
          {i.dependsOn?.length > 0 && <p className="text-sm text-muted">↳ depends on {i.dependsOn.join(', ')}</p>}
        </li>
      ))}
    </ol>
  );
}
