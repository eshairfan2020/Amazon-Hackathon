'use client';
import Link from 'next/link';
import Modal from './Modal';
import RiskBadge from './RiskBadge';
import BarcodeLabel from './BarcodeLabel';
import { dash, money2, num, shortDate } from '@/lib/inventory';

export default function SkuDetail({ item, onClose }) {
  const m = item.metrics;
  const rows = [
    ['Sales velocity', `${m.velocity} units/day`], ['Days of cover', dash(m.daysOfCover, ' days')],
    ['Projected stockout', shortDate(m.stockoutDate)], ['Reorder point', `${num(m.reorderPointRecommended)} units`],
    ['Recommended reorder', `${num(m.recommendedReorderQty)} units`], ['Reorder by', shortDate(m.recommendedReorderDate)],
    ['Stockout risk', m.stockoutRisk], ['Overstock risk', m.overstockRisk],
    ['Fulfillable / inbound', `${num(item.currentStock)} / ${num(item.inbound)}`], ['Reserved / unfulfillable', `${num(item.reserved)} / ${num(item.unfulfillable)}`],
    ['Unit cost / price', `${money2(item.unitCost)} / ${money2(item.price)}`], ['Lead time', `${item.leadTimeDays} days`],
  ];
  return (
    <Modal title={`${item.sku} · ${item.name}`} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2"><RiskBadge value={m.classification} /><span className="text-sm text-muted">Health score {m.healthScore}/100</span></div>
      <section className="card-ai mb-4" aria-label="Explanation">
        <h3 className="mb-1 font-semibold text-ai">✦ Why this rating</h3>
        <p>{m.explanation}</p>
      </section>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-line py-1"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      <section className="mt-4" aria-label="Barcode label">
        <h3 className="mb-2 text-sm font-semibold">Barcode label</h3>
        <BarcodeLabel code={item.barcode} />
        <p className="mt-1 text-xs text-muted">Open Scan &amp; Count on your phone and point the camera at this code.</p>
      </section>
      <p className="mt-3 text-xs text-muted">All figures are estimates from the last 90 days of sales, not guarantees.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Link href={`/orders?sku=${encodeURIComponent(item.sku)}`} className="btn" onClick={onClose}>View orders for this SKU</Link>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}