'use client';
import { useState } from 'react';
import * as api from '@/lib/api';

export default function TaskForm({ onCreated, onCancel }) {
  const [v, setV] = useState({ title: '', dueAt: '', effortHours: '2' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (!v.title.trim()) er.title = 'Title is required.';
    else if (v.title.length > 120) er.title = 'Keep the title under 120 characters.';
    if (!v.dueAt) er.dueAt = 'Choose a deadline.';
    if (!(Number(v.effortHours) > 0)) er.effortHours = 'Enter effort greater than 0.';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    setFail('');
    try {
      onCreated(await api.createTask({ title: v.title.trim(), dueAt: v.dueAt, effortHours: Number(v.effortHours) }));
    } catch (x) {
      setFail(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor="tf-title">Title</label>
      <input id="tf-title" className="input" value={v.title} onChange={set('title')} aria-invalid={!!err.title} />
      <p className="err">{err.title}</p>
      <label className="label" htmlFor="tf-due">Deadline</label>
      <input id="tf-due" type="datetime-local" className="input" value={v.dueAt} onChange={set('dueAt')} aria-invalid={!!err.dueAt} />
      <p className="err">{err.dueAt}</p>
      <label className="label" htmlFor="tf-eff">Estimated effort (hours)</label>
      <input id="tf-eff" type="number" min="0" step="0.5" className="input" value={v.effortHours} onChange={set('effortHours')} aria-invalid={!!err.effortHours} />
      <p className="err">{err.effortHours}</p>
      {fail && <p role="alert" className="err">{fail}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create task'}</button>
      </div>
    </form>
  );
}
