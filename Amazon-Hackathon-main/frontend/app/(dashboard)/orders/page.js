'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import MetricCard from '@/components/MetricCard';
import LineChart from '@/components/LineChart';
import BarChart from '@/components/BarChart';
import OrdersTable from '@/components/OrdersTable';
import OrderDetail from '@/components/OrdersDetail';
import CustomerHistory from '@/components/CustomerHistory';
import OrdersImportDialog from '@/components/OrdersImportDialog';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { useAsync } from '@/lib/useAsync';
import { useDebounced } from '@/lib/useDebounced';
import { money, money2, num, shortDate } from '@/lib/inventory';
import { STATUS_OPTIONS, ORDER_STATUS_META, fmtDay } from '@/lib/orders';
import * as api from '@/lib/api';

const PERIODS = [7, 30, 90];
const Panel = ({ title, note, children }) => (
  <section className="card"><h2 className="font-semibold">{title}</h2>{note && <p className="mb-2 text-xs text-muted">{note}</p>}<div className="mt-2">{children}</div></section>
);

function OrdersView() {
  const params = useSearchParams();
  const [days, setDays] = useState(30);
  const [filters, setFilters] = useState({ status: '', q: '', sku: params.get('sku') || '' });
  const [cursors, setCursors] = useState(['']);
  const [dialog, setDialog] = useState(null); // {kind:'order'|'customer'|'import'}
  const me = useAsync(api.getMe);
  const summary = useAsync(useCallback(() => api.getOrderSummary(days), [days]));
  const customers = useAsync(api.getCustomers);
  const q = useDebounced(filters.q);
  const sku = useDebounced(filters.sku);
  const { status } = filters;
  const from = useMemo(() => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10), [days]);
  const cursor = cursors[cursors.length - 1];

  useEffect(() => { setCursors(['']); }, [q, sku, status, days]);
  const list = useAsync(useCallback(() => api.listOrders({ status, q, sku, from, limit: 12, cursor }), [status, q, sku, from, cursor]));
  const canImport = ['admin', 'manager'].includes(me.data?.role);
  const s = summary.data;
  const start = cursors.length === 1 ? 0 : Number(cursor);
  const close = () => setDialog(null);
  const reloadAll = () => { summary.reload(); customers.reload(); list.reload(); };

  return (
    <>
      <PageHeader
        title="Orders & Deliveries"
        subtitle="Orders received, parcels delivered, returns and your customers (anonymous IDs)"
        actions={<>
          <div className="flex gap-1" role="group" aria-label="Period">
            {PERIODS.map((d) => <button key={d} className={`btn ${days === d ? 'border-ai text-ai' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>)}
          </div>
          {canImport && <button className="btn" onClick={() => setDialog({ kind: 'import' })}>Import CSV</button>}
        </>}
      />
      {s?.demo && <p role="status" className="mb-4 rounded-xl border border-warning/40 px-3 py-2 text-sm text-warning">Synthetic demo orders: these are generated sample data, not real sales or real customers.</p>}
      {summary.loading && !s && <LoadingSkeleton rows={3} />}
      {summary.error && <ErrorState message={summary.error} onRetry={summary.reload} />}
      {s && s.received === 0 && list.data?.total === 0 && !filters.q && !filters.sku && !filters.status ? (
        <EmptyState title="No orders yet" hint="Import your orders from a CSV, or load the demo data from Settings (empty catalogs only)." />
      ) : s && (
        <div className="mb-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Orders received" value={num(s.received)} hint={`last ${s.days} days`} />
            <MetricCard label="Parcels delivered" value={num(s.parcelsDelivered)} tone="text-success" hint={`${s.avgDeliveryDays == null ? 'no' : `avg ${s.avgDeliveryDays}`} days to deliver · includes ${s.returned} later returned`} />
            <MetricCard label="In transit" value={num(s.inTransit)} tone="text-secondary" hint={`${num(s.pending)} more waiting to ship`} />
            <MetricCard label="Returned" value={num(s.returned)} tone="text-highlight" hint={`${s.returnRate}% of delivered parcels`} />
            <MetricCard label="Cancelled" value={num(s.cancelled)} />
            <MetricCard label="Net revenue" value={money(s.revenue)} hint={`${num(s.units)} units, after cancellations and returns`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Orders per day"><LineChart title="Orders per day" data={s.perDay.map((d) => ({ label: shortDate(d.date), value: d.orders }))} /></Panel>
            <Panel title="Best-selling products" note="Units in delivered, shipped and pending orders"><BarChart title="Best-selling products" data={s.topProducts.map((p) => ({ label: p.sku, value: p.units, note: p.name }))} format={num} /></Panel>
          </div>
          {s.returnsBySku.length > 0 && <Panel title="Most returned products" note="Products with at least 5 orders"><BarChart title="Most returned products" data={s.returnsBySku.map((r) => ({ label: r.sku, value: r.returned, fill: 'fill-highlight', note: `${r.rate}% of ${r.orders} orders` }))} format={num} /></Panel>}
        </div>
      )}

      <section aria-label="Orders">
        <h2 className="mb-2 text-lg font-semibold">Order history</h2>
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <div><label htmlFor="o-q" className="sr-only">Search orders</label><input id="o-q" type="search" className="input" placeholder="Search order, customer or product" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></div>
          <div><label htmlFor="o-sku" className="sr-only">Filter by SKU</label><input id="o-sku" type="search" className="input" placeholder="Filter by SKU (e.g. HOM-1009)" value={filters.sku} onChange={(e) => setFilters({ ...filters, sku: e.target.value })} /></div>
          <div><label htmlFor="o-status" className="sr-only">Status</label>
            <select id="o-status" className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>{STATUS_OPTIONS.map((k) => <option key={k} value={k}>{ORDER_STATUS_META[k].label}</option>)}
            </select></div>
        </div>
        {list.loading && !list.data && <LoadingSkeleton rows={4} />}
        {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
        {list.data && list.data.items.length === 0 && <EmptyState title="No orders match" hint="Change the filters or the period." />}
        {list.data && list.data.items.length > 0 && (
          <>
            <OrdersTable items={list.data.items} onOpen={(order) => setDialog({ kind: 'order', order })} />
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Showing {start + 1}-{start + list.data.items.length} of {list.data.total}</span>
              <span className="flex gap-2">
                <button className="btn" disabled={cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Previous</button>
                <button className="btn" disabled={!list.data.nextCursor} onClick={() => setCursors([...cursors, list.data.nextCursor])}>Next</button>
              </span>
            </div>
          </>
        )}
      </section>

      {customers.data && customers.data.customers.length > 0 && (
        <section className="card mt-6" aria-label="Customers">
          <h2 className="font-semibold">Top customers</h2>
          <p className="mb-2 text-xs text-muted">{num(customers.data.totalCustomers)} customers · {customers.data.repeatRate}% ordered more than once · anonymous IDs only</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted"><tr>{['Customer', 'Orders', 'Units', 'Spent', 'Last order', 'Returns', ''].map((h) => <th key={h} scope="col" className="py-1 pr-3 font-medium">{h || 'History'}</th>)}</tr></thead>
              <tbody>
                {customers.data.customers.map((c) => (
                  <tr key={c.customerRef} className="border-t border-line">
                    <td className="py-1 pr-3 font-medium">{c.customerRef}</td><td className="pr-3">{c.orders}</td><td className="pr-3">{c.units}</td><td className="pr-3">{money2(c.spend)}</td>
                    <td className="pr-3">{fmtDay(c.lastOrderAt)}</td><td className="pr-3">{c.returned}</td>
                    <td><button className="btn px-2 py-1" onClick={() => setDialog({ kind: 'customer', ref: c.customerRef })}>Purchase history</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dialog?.kind === 'order' && <OrderDetail order={dialog.order} onClose={close} onCustomer={(ref) => setDialog({ kind: 'customer', ref })} />}
      {dialog?.kind === 'customer' && <CustomerHistory customerRef={dialog.ref} onClose={close} onOrder={(order) => setDialog({ kind: 'order', order })} />}
      {dialog?.kind === 'import' && <OrdersImportDialog onClose={close} onDone={reloadAll} />}
    </>
  );
}

export default function OrdersPage() {
  return <Suspense fallback={<LoadingSkeleton rows={3} />}><OrdersView /></Suspense>;
}