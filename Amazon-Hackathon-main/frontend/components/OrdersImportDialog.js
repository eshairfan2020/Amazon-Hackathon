'use client';
import { useState } from 'react';
import Modal from './Modal';
import * as api from '@/lib/api';
import { ORDERS_TEMPLATE_CSV, parseOrdersCsv } from '@/lib/csv';

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function OrdersImportDialog({ onClose, onDone }) {
  const [parsed, setParsed] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [fail, setFail] = useState('');

  async function pick(e) {
    const f = e.target.files?.[0];
    setResult(null); setFail('');
    if (!f) return;
    setName(f.name);
    setParsed(parseOrdersCsv(await f.text()));
  }
  async function run() {
    setBusy(true); setFail('');
    try {
      const r = await api.importOrders(parsed.rows);
      setResult(r);
      if (r.created + r.updated > 0) onDone();
    } catch (x) { setFail(x.message); } finally { setBusy(false); }
  }
  const orderCount = parsed && !parsed.error ? new Set(parsed.rows.map((r) => r.orderNumber)).size : 0;

  return (
    <Modal title="Import orders from CSV" onClose={onClose} wide>
      <p className="mb-2 text-sm text-muted">One row per order line. Rows with the same order number form one order, and existing order numbers are updated. Products must already exist (matched by SKU).</p>
      <p className="mb-3 rounded-xl border border-warning/40 p-2 text-sm text-warning">Privacy: use an anonymous customer ID only (for example CUST-A1). Do not upload names, emails or addresses; rows containing them are rejected.</p>
      <button type="button" className="btn mb-3" onClick={() => download(ORDERS_TEMPLATE_CSV, 'anchor-orders-template.csv')}>Download template</button>
      <label className="label !mt-0" htmlFor="orders-csv">CSV file</label>
      <input id="orders-csv" type="file" accept=".csv,text/csv" className="input" onChange={pick} />
      {parsed?.error && <p role="alert" className="err mt-2">{parsed.error}</p>}
      {parsed && !parsed.error && <p className="mt-2 text-sm">{name}: <b>{parsed.rows.length}</b> lines in <b>{orderCount}</b> orders.{parsed.ignored.length > 0 && <span className="text-muted"> Ignored columns: {parsed.ignored.join(', ')}.</span>}</p>}
      {fail && <p role="alert" className="err mt-2">{fail}</p>}
      {result && (
        <div className="mt-3 rounded-xl border border-line p-3 text-sm" role="status">
          <p>Created {result.created}, updated {result.updated}, skipped {result.failed.length}.</p>
          {result.failed.slice(0, 10).map((f) => <p key={f.orderNumber} className="text-danger">{f.orderNumber}: {f.errors.join('; ')}</p>)}
          {result.failed.length > 10 && <p className="text-muted">…and {result.failed.length - 10} more.</p>}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
        <button className="btn-primary" disabled={busy || !parsed || !!parsed.error || !!result} onClick={run}>{busy ? 'Importing…' : 'Import'}</button>
      </div>
    </Modal>
  );
}