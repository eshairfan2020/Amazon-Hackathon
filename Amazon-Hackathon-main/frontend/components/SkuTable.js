'use client';
import RiskBadge from './RiskBadge';
import { dash, num } from '@/lib/inventory';

const COLS = [
  ['sku', 'SKU'], ['name', 'Product'], ['category', 'Category'], ['currentStock', 'Stock'], ['inbound', 'Inbound'],
  ['daysOfCover', 'Days of cover'], ['velocity', 'Units/day'], ['classification', 'Risk'], ['healthScore', 'Health'],
];

export default function SkuTable({ items, sort, dir, onSort, canEdit, canDelete, onView, onEdit, onDelete }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            {COLS.map(([key, label]) => (
              <th key={key} scope="col" aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 font-medium">
                <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => onSort(key)}>
                  {label}<span aria-hidden="true">{sort === key ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.skuId} className="border-b border-line last:border-0 hover:bg-surfaceHover">
              <td className="px-3 py-2"><div className="font-medium">{i.sku}</div><div className="text-xs text-muted">{i.asin}</div></td>
              <td className="max-w-[220px] px-3 py-2"><div className="truncate">{i.name}</div><div className="truncate text-xs text-muted">{i.supplier}</div></td>
              <td className="px-3 py-2">{i.category}</td>
              <td className="px-3 py-2">{num(i.currentStock)}</td>
              <td className="px-3 py-2">{num(i.inbound)}</td>
              <td className="px-3 py-2">{dash(i.metrics.daysOfCover)}</td>
              <td className="px-3 py-2">{i.metrics.velocity}</td>
              <td className="px-3 py-2"><RiskBadge value={i.metrics.classification} /></td>
              <td className="px-3 py-2">{i.metrics.healthScore}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <button className="btn px-2 py-1" onClick={() => onView(i)}>Why?</button>
                  {canEdit && <button className="btn px-2 py-1" onClick={() => onEdit(i)}>Edit</button>}
                  {canDelete && <button className="btn-danger px-2 py-1" onClick={() => onDelete(i)}>Delete</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
