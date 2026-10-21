'use client';
import { useState } from 'react';
import Modal from './Modal';
import { STATUSES } from '@/lib/inventory';

const TEXT = [['sku', 'SKU'], ['asin', 'ASIN'], ['name', 'Product name', true], ['category', 'Category'], ['supplier', 'Supplier'], ['warehouse', 'Warehouse / FBA location'], ['marketplace', 'Marketplace']];
const NUM = [['unitCost', 'Unit cost ($)', '0.01'], ['price', 'Selling price ($)', '0.01'], ['currentStock', 'Current stock', '1'], ['inbound', 'Inbound stock', '1'], ['reserved', 'Reserved stock', '1'], ['unfulfillable', 'Unfulfillable stock', '1'], ['leadTimeDays', 'Lead time (days)', '1'], ['safetyStock', 'Safety stock', '1'], ['reorderPoint', 'Reorder point', '1']];
const DEFAULTS = { sku: '', asin: '', name: '', category: '', supplier: '', warehouse: '', marketplace: 'US', unitCost: '', price: '', currentStock: '', inbound: '0', reserved: '0', unfulfillable: '0', leadTimeDays: '', safetyStock: '0', reorderPoint: '0', status: 'active' };

function validate(v) {
  const e = {};
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(v.sku.trim())) e.sku = '2-40 characters: letters, numbers, . _ -';
  if (!/^[A-Za-z0-9]{10}$/.test(v.asin.trim())) e.asin = 'ASIN is 10 letters or digits';
  TEXT.forEach(([k]) => { if (!v[k].trim()) e[k] = 'Required'; });
  NUM.forEach(([k, , step]) => {
    const n = Number(v[k]);
    if (v[k] === '' || !Number.isFinite(n) || n < 0) e[k] = 'Enter a number, 0 or more';
    else if (step === '1' && !Number.isInteger(n)) e[k] = 'Whole numbers only';
  });
  if (!e.price && Number(v.price) <= 0) e.price = 'Must be greater than 0';
  return e;
}

export default function SkuForm({ item, categories = [], onSubmit, onCancel }) {
  const [v, setV] = useState(item ? Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, String(item[k])])) : DEFAULTS);
  const [err, setErr] = useState({});
  const [fail, setFail] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const er = validate(v);
    setErr(er);
    if (Object.keys(er).length) return;
    const payload = {};
    Object.keys(DEFAULTS).forEach((k) => { payload[k] = NUM.some(([n]) => n === k) ? Number(v[k]) : v[k].trim(); });
    setBusy(true);
    setFail('');
    try {
      await onSubmit(payload);
    } catch (x) {
      setFail([x.message, ...(x.details || []).map((d) => `${d.path}: ${d.message}`)].join(' | '));
      setBusy(false);
    }
  }

  const field = (k, label, extra = {}) => (
    <div key={k} className={extra.full ? 'sm:col-span-2' : ''}>
      <label className="label !mt-0" htmlFor={`sf-${k}`}>{label}</label>
      <input id={`sf-${k}`} className="input" value={v[k]} onChange={set(k)} aria-invalid={!!err[k]} {...(extra.input || {})} />
      <p className="err">{err[k]}</p>
    </div>
  );

  return (
    <Modal title={item ? `Edit ${item.sku}` : 'Add SKU'} onClose={onCancel} wide>
      <form onSubmit={submit} noValidate>
        <datalist id="sf-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {TEXT.map(([k, label, full]) => field(k, label, { full, input: k === 'category' ? { list: 'sf-cats' } : {} }))}
          {NUM.map(([k, label, step]) => field(k, label, { input: { type: 'number', min: 0, step, inputMode: 'decimal' } }))}
          <div>
            <label className="label !mt-0" htmlFor="sf-status">Status</label>
            <select id="sf-status" className="input" value={v.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            <p className="err" />
          </div>
        </div>
        {fail && <p role="alert" className="err mb-2">{fail}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Create SKU'}</button>
        </div>
      </form>
    </Modal>
  );
}
