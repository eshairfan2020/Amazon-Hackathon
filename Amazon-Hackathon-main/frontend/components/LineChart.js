/** Simple line chart in SVG. data: [{label, value}] */
export default function LineChart({ data, title }) {
  if (data.length < 2) return <p className="text-sm text-muted">Not enough data.</p>;
  const W = 460; const H = 150; const P = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = (W - 2 * P) / (data.length - 1);
  const y = (v) => H - P - (v / max) * (H - 2 * P);
  const points = data.map((d, i) => `${P + i * step},${y(d.value)}`).join(' ');
  return (
    <svg role="img" aria-label={title} viewBox={`0 0 ${W} ${H}`} className="w-full">
      <title>{title}</title>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="stroke-line" strokeWidth="1" />
      <polyline points={points} fill="none" className="stroke-ai" strokeWidth="2" />
      <text x={P} y={H - 8} className="fill-muted text-[10px]">{data[0].label}</text>
      <text x={W - P} y={H - 8} textAnchor="end" className="fill-muted text-[10px]">{data[data.length - 1].label}</text>
      <text x={P} y={14} className="fill-muted text-[10px]">peak {max.toLocaleString()} units/day</text>
    </svg>
  );
}
