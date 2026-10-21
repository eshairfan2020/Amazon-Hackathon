export default function EvidencePanel({ items = [] }) {
  if (!items.length) return null;
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-muted">Why? (estimate, not a certainty)</summary>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{items.map((e) => <li key={e}>{e}</li>)}</ul>
    </details>
  );
}
