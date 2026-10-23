'use client';
import Modal from './Modal';
import OrderStatusBadge from './OrderStatusBadge';
import LoadingSkeleton from './LoadingSkeleton';
import ErrorState from './ErrorState';
import { useAsync } from '@/lib/useAsync';
import { useCallback } from 'react';
import { money2 } from '@/lib/inventory';
import { fmtDay } from '@/lib/orders';
import * as api from '@/lib/api';

export default function CustomerHistory({ customerRef, onClose, onOrder }) {
  const fetcher = useCallback(() => api.getCustomer(customerRef), [customerRef]);
  const { data, loading, error, reload } = useAsync(fetcher);
  return (
    <Modal title={`Customer ${customerRef}`} onClose={onClose} wide>
      <p className="mb-3 text-xs text-muted">Anonymous customer ID. No names, emails or addresses are stored.</p>
      {loading && <LoadingSkeleton rows={2} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[['Orders', data.profile.orders], ['Units bought', data.profile.units], ['Total spent', money2(data.profile.spend)], ['Returns', data.profile.returned]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-2"><dt className="text-xs text-muted">{k}</dt><dd className="text-lg font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-muted"><tr><th scope="col" className="py-1 font-medium">Order</th><th scope="col" className="font-medium">Date</th><th scope="col" className="font-medium">Items</th><th scope="col" className="font-medium">Total</th><th scope="col" className="font-medium">Status</th></tr></thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.orderId} className="border-t border-line">
                    <td className="py-1"><button className="text-secondary underline" onClick={() => onOrder(o)}>{o.orderNumber}</button></td>
                    <td>{fmtDay(o.placedAt)}</td>
                    <td>{o.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}</td>
                    <td>{money2(o.total)}</td>
                    <td><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end"><button className="btn" onClick={onClose}>Close</button></div>
    </Modal>
  );
}