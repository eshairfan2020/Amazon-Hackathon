'use client';
import Modal from './Modal';

export default function ConfirmDialog({ title, message, confirmLabel, danger, busy, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-4 text-muted">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </Modal>
  );
}
