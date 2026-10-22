'use client';
import { useCallback, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import BarcodeScanner from '@/components/BarcodeScanner';
import RiskBadge from '@/components/RiskBadge';
import { useToast } from '@/components/Toast';
import { useAsync } from '@/lib/useAsync';
import { money2, num } from '@/lib/inventory';
import * as api from '@/lib/api';

const TYPES = [
  ['receive', 'Receive shipment', 'Units arrived: adds to stock and reduces inbound.'],
  ['count', 'Cycle count', 'Enter the physical count. System stock is corrected to match.'],
  ['damaged', 'Mark damaged', 'Moves sellable units to unfulfillable.'],
];
const TYPE_LABEL = { receive: 'Received', count: 'Counted', damaged: 'Damaged' };

export default function ScanPage() {
  const me = useAsync(api.getMe);
  const history = useAsync(api.listAdjustments);
  const [code, setCode] = useState('');
  const [item, setItem] = useState(null);
  const [lookupErr, setLookupErr] = useState('');
  const [looking, setLooking] = useState(false);
  const [type, setType] = useState('receive');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [fail, setFail] = useState('');
  const [last, setLast] = useState(null);
  const [toast, show] = useToast();
  const canAdjust = ['admin', 'manager'].includes(me.data?.role);

  const lookup = useCallback(async (raw) => {
    const c = raw.trim();
    if (!c) return;
    setLooking(true); setLookupErr(''); setLast(null); setFail('');
    try {
      setItem(await api.lookupCode(c));
      setQty(''); setNote(''); setCode('');
    } catch (e) {
      setItem(null);
      setLookupErr(e.status === 404 ? `No SKU matches "${c}". Check the code, or add this barcode to the SKU.` : e.message);
    } finally {
      setLooking(false);
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    const n = Number(qty);
    if (qty === '' || !Number.isInteger(n) || n < 0 || (type !== 'count' && n === 0)) {
      setFail(type === 'count' ? 'Enter the counted quantity (0 or more).' : 'Enter a whole number greater than 0.');
      return;
    }
    setSaving(true); setFail('');
    try {
      const r = await api.adjustStock(item.skuId, { type, quantity: n, note: note.trim() || undefined });
      setItem(r.sku); setLast(r.adjustment); setQty(''); setNote('');
      show('Stock updated'); history.reload();
    } catch (x) {
      setFail(x.message);
    } finally {
      setSaving(false);
    }
  }

  const m = item?.metrics;
  return (
    <>
      <PageHeader title="Scan & Count" subtitle="Scan a barcode, confirm what is physically on the shelf, and the risk ratings update instantly" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card" aria-label="Scan or enter a code">
          <h2 className="mb-2 font-semibold">1. Scan or enter a code</h2>
          <BarcodeScanner onDetect={lookup} />
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
            <label htmlFor="scan-code" className="sr-only">Barcode, ASIN or SKU</label>
            <input id="scan-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Barcode, ASIN or SKU (USB scanners work here)" autoComplete="off" />
            <button className="btn-primary" disabled={looking || !code.trim()}>{looking ? 'Looking…' : 'Look up'}</button>
          </form>
          {lookupErr && <p role="alert" className="err mt-2">{lookupErr}</p>}
          <p className="mt-3 text-xs text-muted">Demo tip: open a SKU in the SKUs page (Why?) to display its barcode, then scan it with your phone camera.</p>
        </section>

        <section className="card" aria-label="Scanned product">
          <h2 className="mb-2 font-semibold">2. Confirm and update stock</h2>
          {!item && <p className="text-sm text-muted">Scan or look up a product to see its stock and risk.</p>}
          {item && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{item.name}</p><p className="text-sm text-muted">{item.sku} · {item.asin}{item.barcode ? ` · ${item.barcode}` : ''}</p></div>
                <RiskBadge value={m.classification} />
              </div>
              <dl className="my-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[['On hand', item.currentStock], ['Inbound', item.inbound], ['Reserved', item.reserved], ['Unfulfillable', item.unfulfillable]].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-line p-2"><dt className="text-xs text-muted">{k}</dt><dd className="text-lg font-semibold">{num(v)}</dd></div>
                ))}
              </dl>
              <p className="mb-3 rounded-xl border border-ai/50 p-2 text-sm"><span className="text-ai">✦</span> {m.explanation}</p>

              {last && (
                <div role="status" className="mb-3 rounded-xl border border-success/50 p-3 text-sm">
                  <p className="font-medium">{TYPE_LABEL[last.type]} {last.quantity} units. Stock {last.before.currentStock} → {last.after.currentStock}.</p>
                  {last.type === 'count' && last.delta !== 0 && <p className="text-warning">Discrepancy: system said {last.before.currentStock}, shelf has {last.after.currentStock} ({last.delta > 0 ? '+' : ''}{last.delta} units, {money2(last.varianceValue)}).</p>}
                  {last.type === 'count' && last.delta === 0 && <p className="text-success">Count matches the system.</p>}
                  {last.riskBefore !== last.riskAfter && <p className="mt-1 flex flex-wrap items-center gap-2">Risk changed: <RiskBadge value={last.riskBefore} /> → <RiskBadge value={last.riskAfter} /></p>}
                </div>
              )}

              {canAdjust ? (
                <form onSubmit={submit} noValidate>
                  <fieldset className="mb-2">
                    <legend className="mb-1 text-sm text-muted">Action</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {TYPES.map(([k, label]) => (
                        <label key={k} className={`chip cursor-pointer justify-center ${type === k ? 'border-ai text-ai' : ''}`}>
                          <input type="radio" name="adj-type" className="sr-only" checked={type === k} onChange={() => { setType(k); setFail(''); }} />{label}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted">{TYPES.find(([k]) => k === type)[2]}</p>
                  </fieldset>
                  <label className="label !mt-1" htmlFor="adj-qty">{type === 'count' ? 'Counted quantity' : 'Quantity'}</label>
                  <input id="adj-qty" type="number" min="0" step="1" inputMode="numeric" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
                  <label className="label" htmlFor="adj-note">Note (optional)</label>
                  <input id="adj-note" className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
                  {fail && <p role="alert" className="err mt-1">{fail}</p>}
                  <button className="btn-primary mt-3 w-full" disabled={saving}>{saving ? 'Saving…' : 'Update stock'}</button>
                </form>
              ) : <p className="text-sm text-muted">Your role can look up products but cannot change stock.</p>}
            </>
          )}
        </section>
      </div>

      <section className="card mt-4" aria-label="Recent stock updates">
        <h2 className="mb-2 font-semibold">Recent stock updates</h2>
        {history.error && <p className="text-sm text-danger">{history.error}</p>}
        {history.data && history.data.length === 0 && <p className="text-sm text-muted">No scans recorded yet.</p>}
        {history.data && history.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted"><tr><th scope="col" className="py-1 pr-3 font-medium">Time</th><th scope="col" className="pr-3 font-medium">SKU</th><th scope="col" className="pr-3 font-medium">Action</th><th scope="col" className="pr-3 font-medium">Stock change</th><th scope="col" className="pr-3 font-medium">Variance</th><th scope="col" className="font-medium">Risk</th></tr></thead>
              <tbody>
                {history.data.map((a) => (
                  <tr key={a.adjustmentId} className="border-t border-line">
                    <td className="py-1 pr-3">{new Date(a.at).toLocaleString()}</td>
                    <td className="pr-3">{a.sku}</td>
                    <td className="pr-3">{TYPE_LABEL[a.type]} {a.quantity}</td>
                    <td className="pr-3">{a.before.currentStock} → {a.after.currentStock}</td>
                    <td className={`pr-3 ${a.varianceValue < 0 ? 'text-danger' : ''}`}>{a.type === 'count' ? money2(a.varianceValue) : '-'}</td>
                    <td>{a.riskBefore === a.riskAfter ? <RiskBadge value={a.riskAfter} /> : <span className="flex items-center gap-1"><RiskBadge value={a.riskBefore} />→<RiskBadge value={a.riskAfter} /></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {toast}
    </>
  );
}