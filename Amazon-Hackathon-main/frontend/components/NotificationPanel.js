'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as api from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import RiskBadge from './RiskBadge';

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState([]);
  const { data, loading, error } = useAsync(api.getAlertSkus);
  const items = (data || []).filter((n) => !dismissed.includes(n.skuId)).slice(0, 5);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="relative">
      <button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>🔔 {items.length}</button>
      {open && (
        <div role="region" aria-label="Stockout alerts" className="card absolute right-0 z-30 mt-2 w-80 shadow-xl">
          <h2 className="mb-2 font-semibold">Stockout alerts</h2>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {!loading && !error && items.length === 0 && <p className="text-sm text-muted">No SKUs at risk right now.</p>}
          {items.map((n) => (
            <div key={n.skuId} className="mb-2 rounded-xl border border-line p-2 text-sm">
              <RiskBadge value={n.classification} />
              <p className="mt-1">{n.sku} · {n.name}</p>
              <p className="text-muted">About {n.daysOfCover} days of cover left (estimate)</p>
              <button className="mt-1 text-secondary underline" onClick={() => setDismissed([...dismissed, n.skuId])}>Dismiss</button>
            </div>
          ))}
          <Link href="/skus" onClick={() => setOpen(false)} className="text-sm text-secondary underline">Open SKU list</Link>
        </div>
      )}
    </div>
  );
}
