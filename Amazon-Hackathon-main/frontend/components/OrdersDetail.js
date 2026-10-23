'use client';
import Modal from './Modal';
import OrderStatusBadge from './OrderStatusBadge';
import { money2 } from '@/lib/inventory';
import { fmtWhen } from '@/lib/orders';

export default function OrderDetail({ order: o, onClose, onCustomer }) {
  const steps = [['Placed', o.placedAt], ['Shipped', o.shipment?.shippedAt], ['Delivered', o.shipment?.deliveredAt]];
  return (
    <Modal title={`Order ${o.orderNumber}`} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={o.status} />
        {o.demo && <span className="pill border-warning/50 text-warning">Synthetic demo order</span>}
        {o.customerRef && <button className="btn px-2 py-1" onClick={() => onCustomer(o.customerRef)}>Customer {o.customerRef}</button>}
      </div>
      <ol className="mb-4 grid gap-2 sm:grid-cols-3" aria-label="Delivery progress">
        {steps.map(([label, when]) => (
          <li key={label} className={`rounded-xl border p-2 text-sm ${when ? 'border-success/50' : 'border-line text-muted'}`}>
            <p className="font-medium">{when ? '✓ ' : ''}{label}</p><p className="text-xs">{fmtWhen(when)}</p>
          </li>
        ))}
      </ol>
      {o.shipment && <p className="mb-3 text-sm text-muted">Carrier: {o.shipment.carrier || 'not set'} · Tracking: {o.shipment.trackingRef || 'not set'}</p>}
      <table className="w-full text-left text-sm">
        <thead className="text-muted"><tr><th scope="col" className="py-1 font-medium">Product</th><th scope="col" className="font-medium">Qty</th><th scope="col" className="font-medium">Unit price</th><th scope="col" className="text-right font-medium">Line total</th></tr></thead>
        <tbody>
          {o.lines.map((l) => (
            <tr key={l.sku} className="border-t border-line"><td className="py-1">{l.name} <span className="text-xs text-muted">({l.sku})</span></td><td>{l.quantity}</td><td>{money2(l.unitPrice)}</td><td className="text-right">{money2(l.quantity * l.unitPrice)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t border-line font-semibold"><td colSpan={3} className="py-1">Order total</td><td className="text-right">{money2(o.total)}</td></tr></tfoot>
      </table>
      <div className="mt-4 flex justify-end"><button className="btn" onClick={onClose}>Close</button></div>
    </Modal>
  );
}