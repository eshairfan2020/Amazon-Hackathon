'use client';
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import FilterBar, { EMPTY_FILTERS } from '@/components/FilterBar';
import SkuTable from '@/components/SkuTable';
import SkuForm from '@/components/SkuForm';
import SkuDetail from '@/components/SkuDetail';
import CsvImportDialog from '@/components/CsvImportDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorState from '@/components/ErrorState';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { useAsync } from '@/lib/useAsync';
import { useDebounced } from '@/lib/useDebounced';
import * as api from '@/lib/api';

const LIMIT = 15;

export default function SkusPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('sku');
  const [dir, setDir] = useState('asc');
  const [cursors, setCursors] = useState(['']);
  const [dialog, setDialog] = useState(null); // {kind:'add'|'edit'|'view'|'delete'|'import', item?}
  const [toast, show] = useToast();
  const me = useAsync(api.getMe);
  const q = useDebounced(filters.q);
  const cursor = cursors[cursors.length - 1];
  const { category, supplier, warehouse, marketplace, risk, status } = filters;

  useEffect(() => { setCursors(['']); }, [q, category, supplier, warehouse, marketplace, risk, status, sort, dir]);
  const fetcher = useCallback(() => api.listSkus({ q, category, supplier, warehouse, marketplace, risk, status, sort, dir, limit: LIMIT, cursor }), [q, category, supplier, warehouse, marketplace, risk, status, sort, dir, cursor]);
  const { data, loading, error, reload } = useAsync(fetcher);

  const role = me.data?.role;
  const canEdit = role === 'admin' || role === 'manager';
  const onSort = (key) => { if (key === sort) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDir('asc'); } };
  const close = () => setDialog(null);
  const start = cursors.length === 1 ? 0 : Number(cursor);
  const filtered = Object.values(filters).some(Boolean);

  async function save(payload) {
    if (dialog.kind === 'edit') await api.updateSku(dialog.item.skuId, payload); else await api.createSku(payload);
    show(dialog.kind === 'edit' ? 'SKU updated' : 'SKU created');
    close(); reload();
  }
  async function remove() {
    try { await api.deleteSku(dialog.item.skuId); show('SKU deleted'); reload(); } catch (e) { show(e.message, 'border-danger'); }
    close();
  }
  async function exportCsv() {
    try {
      const blob = await api.exportSkusCsv({ q, category, supplier, warehouse, marketplace, risk, status });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'anchor-skus.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { show(e.message, 'border-danger'); }
  }

  return (
    <>
      <PageHeader
        title="SKUs"
        subtitle={data ? `${data.total} SKU${data.total === 1 ? '' : 's'} match` : 'Product catalog and inventory levels'}
        actions={<>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
          {canEdit && <button className="btn" onClick={() => setDialog({ kind: 'import' })}>Import CSV</button>}
          {canEdit && <button className="btn-primary" onClick={() => setDialog({ kind: 'add' })}>+ Add SKU</button>}
        </>}
      />
      <FilterBar facets={data?.facets} value={filters} onChange={setFilters} withStatus />
      {loading && !data && <LoadingSkeleton rows={5} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.items.length === 0 && (
        <EmptyState title={filtered ? 'No SKUs match these filters' : 'No SKUs yet'} hint={filtered ? 'Clear a filter or change the search.' : 'Add a SKU, import a CSV, or load demo data from Settings.'} />
      )}
      {data && data.items.length > 0 && (
        <>
          <SkuTable items={data.items} sort={sort} dir={dir} onSort={onSort} canEdit={canEdit} canDelete={role === 'admin'}
            onView={(item) => setDialog({ kind: 'view', item })} onEdit={(item) => setDialog({ kind: 'edit', item })} onDelete={(item) => setDialog({ kind: 'delete', item })} />
          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <span>Showing {start + 1}-{start + data.items.length} of {data.total}</span>
            <span className="flex gap-2">
              <button className="btn" disabled={cursors.length === 1} onClick={() => setCursors(cursors.slice(0, -1))}>Previous</button>
              <button className="btn" disabled={!data.nextCursor} onClick={() => setCursors([...cursors, data.nextCursor])}>Next</button>
            </span>
          </div>
        </>
      )}
      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && <SkuForm item={dialog.item} categories={data?.facets?.categories} onSubmit={save} onCancel={close} />}
      {dialog?.kind === 'view' && <SkuDetail item={dialog.item} onClose={close} />}
      {dialog?.kind === 'import' && <CsvImportDialog onClose={close} onDone={reload} />}
      {dialog?.kind === 'delete' && <ConfirmDialog title="Delete this SKU?" message={`${dialog.item.sku} · ${dialog.item.name} and its sales history will be removed. This cannot be undone.`} confirmLabel="Delete" danger onConfirm={remove} onCancel={close} />}
      {toast}
    </>
  );
}
