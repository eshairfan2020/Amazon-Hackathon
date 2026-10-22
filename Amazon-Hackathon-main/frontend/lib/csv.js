// CSV import helpers. Parsing happens in the browser; the backend validates every row again.
export const HEADER_MAP = {
  sku: 'sku', asin: 'asin', name: 'name', category: 'category', supplier: 'supplier',
  unit_cost: 'unitCost', selling_price: 'price', current_stock: 'currentStock', inbound_stock: 'inbound',
  reserved_stock: 'reserved', unfulfillable_stock: 'unfulfillable', warehouse: 'warehouse', marketplace: 'marketplace',
  lead_time_days: 'leadTimeDays', safety_stock: 'safetyStock', reorder_point: 'reorderPoint', status: 'status', barcode: 'barcode',
};
export const MAX_ROWS = 500;
export const TEMPLATE_CSV = `${Object.keys(HEADER_MAP).join(',')}\nHOM-9001,B0EXAMPLE1,Example Product,Home,Acme Supply,6.5,19.99,120,0,3,0,FBA-ONT8,US,21,20,0,active,8901000090012\n`;

export function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, '');
  const table = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i += 1; row.push(cell); cell = ''; table.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); table.push(row); }

  const lines = table.filter((r) => r.some((c) => c.trim() !== ''));
  if (lines.length < 2) return { rows: [], ignored: [], error: 'The file needs a header row and at least one data row.' };
  const known = new Set(Object.values(HEADER_MAP));
  const keys = lines[0].map((h) => { const t = h.trim(); return HEADER_MAP[t.toLowerCase()] || (known.has(t) ? t : null); });
  const ignored = lines[0].filter((_, i) => !keys[i]).map((h) => h.trim()).filter(Boolean);
  const rows = lines.slice(1).map((r) => {
    const o = {};
    keys.forEach((k, i) => { if (k) o[k] = (r[i] ?? '').trim(); });
    return o;
  });
  if (rows.length > MAX_ROWS) return { rows: [], ignored, error: `Too many rows (${rows.length}). The limit is ${MAX_ROWS} per import.` };
  if (!keys.includes('sku')) return { rows: [], ignored, error: 'Missing required column: sku' };
  return { rows, ignored, error: null };
}