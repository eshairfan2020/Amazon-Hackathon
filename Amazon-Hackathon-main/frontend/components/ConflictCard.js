'use client';
import { useState } from 'react';

export default function ConflictCard({ conflict }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card border-highlight/60">
      <button className="flex w-full items-center justify-between text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span><span className="pill border-highlight/50 text-highlight">⚠ Conflict</span> <span className="ml-2">{conflict.taskId} vs calendar event</span></span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 text-sm">
          <p className="text-muted">{conflict.evidence}</p>
          <p className="mt-2 font-medium">Suggested recovery options</p>
          <ul className="list-disc pl-5 text-muted">{conflict.options.map((o) => <li key={o}>{o}</li>)}</ul>
          <p className="mt-2 text-muted">Anchor never moves events automatically.</p>
          <button className="btn mt-2" disabled title="Choosing an option needs the backend contract">Choose an option</button>
        </div>
      )}
    </div>
  );
}
