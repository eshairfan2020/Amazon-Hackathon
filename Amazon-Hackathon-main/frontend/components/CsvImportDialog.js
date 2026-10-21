'use client';
import { useState } from 'react';
import Modal from './Modal';
import * as api from '@/lib/api';
import { TEMPLATE_CSV, parseCsv } from '@/lib/csv';

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function CsvImportDialog({ onClose, onDone }) {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [fail, setFail] = useState('');

  async function pick(e) {
    const f = e.target.files?.[0];
    setResult(null); setFail('');
    if (!f) return;
    setFileName(f.name);
    setParsed(parseCsv(await f.text()));
  }

  async function run() {
    setBusy(true); setFail('');
    try {
      const r = await api.importSkus(parsed.rows);
      setResult(r);
      if (r.created + r.updated > 0) onDone();
    } catch (x) {
      setFail(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import SKUs from CSV" onClose={onClose} wide>
      <p className="mb-2 text-sm text-muted">Existing SKUs (matched by SKU code) are updated; new ones are created. Rows with errors are skipped and listed below.</p>
      <button type="button" className="btn mb-3" onClick={() => download(TEMPLATE_CSV, 'anchor-sku-template.csv')}>Download template</button>
      <label className="label !mt-0" htmlFor="csv-file">CSV file</label>
      <input id="csv-file" type="file" accept=".csv,text/csv" className="input" onChange={pick} />
      {parsed?.error && <p role="alert" className="err mt-2">{parsed.error}</p>}
      {parsed && !parsed.error && (
        <p className="mt-2 text-sm">{fileName}: <b>{parsed.rows.length}</b> rows ready.{parsed.ignored.length > 0 && <span className="text-muted"> Ignored columns: {parsed.ignored.join(', ')}.</span>}</p>
      )}
      {fail && <p role="alert" className="err mt-2">{fail}</p>}
      {result && (
        <div className="mt-3 rounded-xl border border-line p-3 text-sm" role="status">
          <p>Created {result.created}, updated {result.updated}, skipped {result.failed.length}.</p>
          {result.failed.slice(0, 10).map((f) => <p key={f.row} className="text-danger">Row {f.row}: {f.errors.join('; ')}</p>)}
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
