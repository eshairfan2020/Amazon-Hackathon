'use client';
import { useState } from 'react';
import Modal from './Modal';

export default function MessageDraftEditor({ item, onSave, onCancel }) {
  const [body, setBody] = useState(item.body);
  const [err, setErr] = useState('');
  function save() {
    if (!body.trim()) return setErr('Message cannot be empty.');
    if (body.length > 500) return setErr('Keep the message under 500 characters.');
    onSave(body.trim());
  }
  return (
    <Modal title="Edit draft" onClose={onCancel}>
      <label className="label" htmlFor="draft">Message</label>
      <textarea id="draft" rows={5} className="input" value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={!!err} />
      <p className="err">{err}</p>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save draft</button>
      </div>
    </Modal>
  );
}
