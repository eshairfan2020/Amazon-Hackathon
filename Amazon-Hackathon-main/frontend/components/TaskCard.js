import StatusBadge from './StatusBadge';
import EvidencePanel from './EvidencePanel';
import { fmt } from '@/lib/format';

export default function TaskCard({ task, onOpen }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <button className="text-left font-semibold hover:underline" onClick={() => onOpen(task)}>{task.title}</button>
        <StatusBadge status={task.status} />
      </div>
      <p className="text-sm text-muted">Due {fmt(task.dueAt)}{task.demo ? ' · demo task' : ''}</p>
      {task.status === 'at_risk' && <EvidencePanel items={task.evidence} />}
    </div>
  );
}
