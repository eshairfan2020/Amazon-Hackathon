'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import MetricCard from '@/components/MetricCard';
import BotCard from '@/components/BotCard';
import FilterBar, { EMPTY_FILTERS } from '@/components/FilterBar';
import BarChart from '@/components/BarChart';
import LineChart from '@/components/LineChart';
import RiskBadge from '@/components/RiskBadge';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { useAsync } from '@/lib/useAsync';
import { useDebounced } from '@/lib/useDebounced';
import { CLASS_META, money, num, shortDate } from '@/lib/inventory';
import * as api from '@/lib/api';

const Panel = ({ title, note, children }) => (
  <section className="card"><h2 className="font-semibold">{title}</h2>{note && <p className="mb-2 text-xs text-muted">{note}</p>}<div className="mt-2">{children}</div></section>
);

export default function DashboardPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedQ = useDebounced(filters.q);
  const { category, supplier, warehouse, marketplace, risk } = filters;
  const fetcher = useCallback(() => api.getDashboard({ q: debouncedQ, category, supplier, warehouse, marketplace, risk }), [debouncedQ, category, supplier, warehouse, marketplace, risk]);
  const { data, loading, error, reload } = useAsync(fetcher);
  const me = useAsync(api.getMe);
  const [toast, show] = useToast();
  const [busy, setBusy] = useState(false);
  const canWrite = ['admin', 'manager'].includes(me.data?.role);
  const filtered = Object.values(filters).some(Boolean);

  async function loadDemo() {
    setBusy(true);
    try { await api.loadDemoData(); show('Synthetic demo data loaded'); reload(); } catch (e) { show(e.message, 'border-danger'); } finally { setBusy(false); }
  }

  const t = data?.totals;
  const c = data?.charts;
  const health = t?.healthScore;
  return (
    <>
      <PageHeader title="Inventory Dashboard" subtitle="Stock health, sales velocity and stockout risk across your catalog" actions={<><button className="btn" onClick={reload}>Refresh</button><Link href="/skus" className="btn-primary">Manage SKUs</Link></>} />
      {data && <BotCard totals={data.totals} filtered={filtered} />}
      {data && <FilterBar facets={data.filters} value={filters} onChange={setFilters} />}
      {loading && !data && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && t.totalSkus === 0 && !filtered && (
        <EmptyState title="No inventory yet" hint="Load the labelled synthetic demo catalog, or import your own SKUs from CSV.">
          {canWrite && <button className="btn-primary" disabled={busy} onClick={loadDemo}>{busy ? 'Loading…' : 'Load demo data'}</button>}
          <Link href="/skus" className="btn">Go to SKUs</Link>
        </EmptyState>
      )}
      {data && (t.totalSkus > 0 || filtered) && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Total SKUs" value={num(t.totalSkus)} />
            <MetricCard label="Inventory value" value={money(t.inventoryValue)} hint="Sellable + reserved units at unit cost" />
            <MetricCard label="Low-stock items" value={num(t.lowStock)} tone="text-warning" hint={`${t.criticalStock} critical stockout risk`} />
            <MetricCard label="Overstock items" value={num(t.overstock)} tone="text-secondary" hint={`${t.slowMoving} slow moving, ${t.stranded} stranded`} />
            <MetricCard label="Inbound units" value={num(t.inboundUnits)} />
            <MetricCard label="Inventory health" value={health == null ? '-' : `${health}/100`} tone={health == null ? 'text-ink' : health >= 70 ? 'text-success' : health >= 50 ? 'text-warning' : 'text-danger'} hint="Average SKU score" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Stock by category" note="Fulfillable units on hand"><BarChart title="Stock by category" data={c.stockByCategory.map((x) => ({ label: x.category, value: x.units, note: money(x.value) }))} format={num} /></Panel>
            <Panel title="Lowest days of cover" note="Current stock divided by recent daily sales (estimate)"><BarChart title="Lowest days of cover" data={c.lowestCover.map((x) => ({ label: x.sku, value: x.daysOfCover, fill: CLASS_META[x.classification].fill, note: CLASS_META[x.classification].label }))} format={(v) => `${v}d`} /></Panel>
            <Panel title="Sales velocity" note="Fastest-selling SKUs, units per day"><BarChart title="Sales velocity" data={c.velocityTop.map((x) => ({ label: x.sku, value: x.velocity, fill: 'fill-secondary' }))} /></Panel>
            <Panel title="Units sold, last 30 days" note="All SKUs in view"><LineChart title="Units sold per day, last 30 days" data={c.salesTrend.map((d) => ({ label: shortDate(d.date), value: d.units }))} /></Panel>
          </div>
          <section className="card-ai">
            <h2 className="font-semibold text-ai">✦ Forecasted stockout dates</h2>
            <p className="mb-2 text-xs text-muted">Estimate = current stock ÷ recent sales velocity. Demand forecasting with seasonality arrives in the next phase.</p>
            {c.stockoutForecast.length === 0 ? <p className="text-sm text-muted">No critical or low-stock SKUs in this view.</p> : (
              <ul className="divide-y divide-line">
                {c.stockoutForecast.map((x) => (
                  <li key={x.skuId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span><b>{x.sku}</b> · {x.name}</span>
                    <span className="flex items-center gap-2"><RiskBadge value={x.classification} /><span className="text-muted">out ~{shortDate(x.stockoutDate)} ({x.daysOfCover} days)</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {toast}
    </>
  );
}