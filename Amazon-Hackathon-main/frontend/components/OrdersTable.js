'use client';
import OrderStatusBadge from './OrderStatusBadge';
import { money2 } from '@/lib/inventory';
import { fmtWhen, itemsSummary } from '@/lib/orders';

export default function OrdersTable({ items, onOpen }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>{['Order', 'Placed', 'Customer', 'Items', 'Total', 'Status', 'Parcel', ''].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h || 'Actions'}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.orderId} className="border-b border-line last:border-0 hover:bg-surfaceHover">
              <td className="px-3 py-2 font-medium">{o.orderNumber}</td>
              <td className="px-3 py-2">{fmtWhen(o.placedAt)}</td>
              <td className="px-3 py-2">{o.customerRef || '-'}</td>
              <td className="max-w-[220px] truncate px-3 py-2">{itemsSummary(o)}</td>
              <td className="px-3 py-2">{money2(o.total)}</td>
              <td className="px-3 py-2"><OrderStatusBadge status={o.status} /></td>
              <td className="px-3 py-2 text-xs text-muted">{o.shipment ? `${o.shipment.carrier || 'Carrier'} ${o.shipment.trackingRef}` : '-'}</td>
              <td className="px-3 py-2"><button className="btn px-2 py-1" onClick={() => onOpen(o)}>Details</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}