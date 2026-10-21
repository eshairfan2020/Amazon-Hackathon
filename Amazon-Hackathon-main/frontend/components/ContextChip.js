'use client';

export default function ContextChip({ label, active, onToggle }) {
  return <button type="button" aria-pressed={active} onClick={onToggle} className={`chip ${active ? 'border-ai text-ai' : ''}`}>{label}</button>;
}
