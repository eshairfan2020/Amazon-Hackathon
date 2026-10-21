const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Horizontal bar chart in SVG. data: [{label, value, note?, fill?}] */
export default function BarChart({ data, title, format = String }) {
  if (!data.length) return <p className="text-sm text-muted">No data for these filters.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const rowH = 26;
  return (
    <svg role="img" aria-label={title} viewBox={`0 0 460 ${data.length * rowH + 4}`} className="w-full">
      <title>{title}</title>
      {data.map((d, i) => {
        const w = Math.max(2, (d.value / max) * 150);
        const y = i * rowH + 2;
        return (
          <g key={`${d.label}-${i}`}>
            <text x="0" y={y + 16} className="fill-muted text-[11px]">{trunc(d.label, 22)}</text>
            <rect x="160" y={y + 3} width={w} height="16" rx="3" className={d.fill || 'fill-ai'} />
            <text x={160 + w + 6} y={y + 16} className="fill-ink text-[11px]">{format(d.value)}{d.note ? ` · ${d.note}` : ''}</text>
          </g>
        );
      })}
    </svg>
  );
}
