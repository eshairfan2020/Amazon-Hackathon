import { CLASS_META } from '@/lib/inventory';

export default function RiskBadge({ value }) {
  const m = CLASS_META[value] || { label: value, icon: '•', tone: 'border-line text-muted' };
  return <span className={`pill whitespace-nowrap ${m.tone}`}><span aria-hidden="true">{m.icon}</span>{m.label}</span>;
}
