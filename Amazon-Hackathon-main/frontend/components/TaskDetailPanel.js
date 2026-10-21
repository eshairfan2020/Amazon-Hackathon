'use client';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import EvidencePanel from './EvidencePanel';
import { fmt } from '@/lib/format';

export default function TaskDetailPanel({ task, onClose }) {
  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <StatusBadge status={task.status} />
        <p className="text-muted">Due {fmt(task.dueAt)} · Effort {task.effortHours ?? '?'} h</p>
        <p className="text-muted">Depends on: {task.dependsOn?.length ? task.dependsOn.join(', ') : 'nothing'}</p>
        <EvidencePanel items={task.evidence} />
      </div>
      <div className="mt-4 flex justify-end"><button className="btn" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
