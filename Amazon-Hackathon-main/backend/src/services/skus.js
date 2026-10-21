import { newId } from '../utils/ids.js';
import { notFound } from '../utils/errors.js';
import { computeMetrics } from '../domain/inventory.js';
import { CSV_COLUMNS, skuCreate, skuImportRow, skuPatch } from '../domain/schemas.js';

const SORTERS = {
  sku: (i) => i.sku, name: (i) => i.name.toLowerCase(), category: (i) => i.category.toLowerCase(), supplier: (i) => i.supplier.toLowerCase(),
  currentStock: (i) => i.currentStock, inbound: (i) => i.inbound, price: (i) => i.price, unitCost: (i) => i.unitCost, updatedAt: (i) => i.updatedAt,
  daysOfCover: (i) => i.metrics.daysOfCover, velocity: (i) => i.metrics.velocity, healthScore: (i) => i.metrics.healthScore,
  classification: (i) => i.metrics.classification,
};

/** Neutralise spreadsheet formula injection and quote CSV cells. */
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function createSkuService({ repo, config, clock, audit }) {
  const now = () => new Date(clock()).toISOString();

  async function enriched(userId) {
    const [list, sales] = await Promise.all([repo.listSkus(userId), repo.listSalesByUser(userId)]);
    const t = clock();
    return { items: list.map((s) => ({ ...s, metrics: computeMetrics(s, sales.get(s.skuId) ?? [], t, config.inventory) })), sales };
  }

  function filter(items, f = {}) {
    const q = f.q?.toLowerCase();
    return items.filter((i) =>
      (!q || i.sku.toLowerCase().includes(q) || i.asin.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) &&
      (!f.category || i.category === f.category) && (!f.warehouse || i.warehouse === f.warehouse) &&
      (!f.supplier || i.supplier === f.supplier) && (!f.marketplace || i.marketplace === f.marketplace) &&
      (!f.status || i.status === f.status) && (!f.risk || i.metrics.classification === f.risk));
  }

  function sort(items, field, dir) {
    const get = SORTERS[field];
    const sign = dir === 'desc' ? -1 : 1;
    return items.slice().sort((a, b) => {
      const x = get(a); const y = get(b);
      if (x == null && y == null) return a.sku < b.sku ? -1 : 1;
      if (x == null) return 1; // nulls always last
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : a.sku < b.sku ? -1 : 1) * sign;
    });
  }

  const facets = (items) => {
    const uniq = (f) => [...new Set(items.map(f))].sort();
    return { categories: uniq((i) => i.category), warehouses: uniq((i) => i.warehouse), suppliers: uniq((i) => i.supplier), marketplaces: uniq((i) => i.marketplace) };
  };

  return {
    enriched, filter, facets,

    async list(userId, q) {
      const { items } = await enriched(userId);
      const sorted = sort(filter(items, q), q.sort, q.dir);
      const start = q.cursor ? Number.parseInt(q.cursor, 10) : 0;
      return {
        items: sorted.slice(start, start + q.limit),
        nextCursor: start + q.limit < sorted.length ? String(start + q.limit) : null,
        total: sorted.length,
        facets: facets(items),
      };
    },

    async get(userId, skuId) {
      const sku = await repo.getSku(userId, skuId);
      if (!sku) throw notFound('SKU');
      const sales = (await repo.listSalesByUser(userId)).get(skuId) ?? [];
      return { ...sku, metrics: computeMetrics(sku, sales, clock(), config.inventory) };
    },

    async create(userId, input) {
      const t = now();
      const sku = await repo.createSku({ ...input, skuId: newId('sku'), userId, createdAt: t, updatedAt: t });
      await audit.record(userId, 'sku.create', 'sku', sku.skuId, `Created ${sku.sku}`);
      return this.get(userId, sku.skuId);
    },

    async update(userId, skuId, patch) {
      await repo.updateSku(userId, skuId, { ...patch, updatedAt: now() });
      await audit.record(userId, 'sku.update', 'sku', skuId, `Updated fields: ${Object.keys(patch).join(', ')}`);
      return this.get(userId, skuId);
    },

    async remove(userId, skuId) {
      const sku = await repo.getSku(userId, skuId);
      if (!sku) throw notFound('SKU');
      await repo.deleteSku(userId, skuId);
      await audit.record(userId, 'sku.delete', 'sku', skuId, `Deleted ${sku.sku}`);
      return { skuId, deleted: true };
    },

    /** Upsert by SKU code. Invalid rows are reported, valid rows are saved (partial success). */
    async importRows(userId, rows) {
      const failed = [];
      let created = 0;
      let updated = 0;
      for (let i = 0; i < rows.length; i += 1) {
        const r = skuImportRow.safeParse(rows[i]);
        if (!r.success) { failed.push({ row: i + 1, errors: r.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`) }); continue; }
        const existing = await repo.findSkuByCode(userId, r.data.sku);
        if (existing) { await repo.updateSku(userId, existing.skuId, { ...r.data, updatedAt: now() }); updated += 1; }
        else { const t = now(); await repo.createSku({ ...r.data, skuId: newId('sku'), userId, createdAt: t, updatedAt: t }); created += 1; }
      }
      await audit.record(userId, 'sku.import', 'sku', 'bulk', `Import: ${created} created, ${updated} updated, ${failed.length} failed`);
      return { created, updated, failed };
    },

    async exportCsv(userId, f) {
      const { items } = await enriched(userId);
      const rows = sort(filter(items, f), 'sku', 'asc');
      const head = [...CSV_COLUMNS.map(([h]) => h), 'risk_level', 'days_of_cover', 'recommended_reorder_qty', 'recommended_reorder_date'];
      const lines = [head.join(',')];
      for (const i of rows) {
        const cells = CSV_COLUMNS.map(([, field]) => i[field]);
        cells.push(i.metrics.classificationLabel, i.metrics.daysOfCover, i.metrics.recommendedReorderQty, i.metrics.recommendedReorderDate);
        lines.push(cells.map(csvCell).join(','));
      }
      return `${lines.join('\n')}\n`;
    },
  };
}
