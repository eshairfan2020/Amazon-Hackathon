'use client';
import { CLASS_META, STATUSES } from '@/lib/inventory';

const FACETS = [['category', 'Category', 'categories'], ['supplier', 'Supplier', 'suppliers'], ['warehouse', 'Warehouse', 'warehouses'], ['marketplace', 'Marketplace', 'marketplaces']];
export const EMPTY_FILTERS = { q: '', category: '', supplier: '', warehouse: '', marketplace: '', risk: '', status: '' };

export default function FilterBar({ facets, value, onChange, withStatus = false }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const active = Object.values(value).some(Boolean);
  const select = 'input';
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor="f-q" className="sr-only">Search by SKU, ASIN or product name</label>
        <input id="f-q" type="search" className="input" placeholder="Search by SKU, ASIN or product name" value={value.q} onChange={set('q')} />
      </div>
      {FACETS.map(([key, label, facet]) => (
        <div key={key}>
          <label htmlFor={`f-${key}`} className="sr-only">{label}</label>
          <select id={`f-${key}`} className={select} value={value[key]} onChange={set(key)}>
            <option value="">All {label.toLowerCase()}s</option>
            {(facets?.[facet] || []).map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
      ))}
      <div>
        <label htmlFor="f-risk" className="sr-only">Risk level</label>
        <select id="f-risk" className={select} value={value.risk} onChange={set('risk')}>
          <option value="">All risk levels</option>
          {Object.entries(CLASS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>
      {withStatus && (
        <div>
          <label htmlFor="f-status" className="sr-only">Listing status</label>
          <select id="f-status" className={select} value={value.status} onChange={set('status')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      {active && <button type="button" className="btn" onClick={() => onChange(EMPTY_FILTERS)}>Clear filters</button>}
    </div>
  );
}
