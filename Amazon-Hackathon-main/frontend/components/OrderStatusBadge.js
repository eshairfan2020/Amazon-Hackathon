import { ORDER_STATUS_META } from '@/lib/orders';

export default function OrderStatusBadge({ status }) {
  const m = ORDER_STATUS_META[status] || { label: status, icon: '•', tone: 'border-line text-muted' };
  return <span className={`pill whitespace-nowrap ${m.tone}`}><span aria-hidden="true">{m.icon}</span>{m.label}</span>;
}