import { z } from 'zod';

export const ROLES = ['admin', 'manager', 'viewer'];
export const SKU_STATUS = ['active', 'inactive', 'stranded'];
export const RISK_KEYS = ['healthy', 'low_stock', 'critical', 'overstock', 'slow_moving', 'stranded'];
export const SORT_FIELDS = ['sku', 'name', 'category', 'supplier', 'currentStock', 'inbound', 'price', 'unitCost', 'updatedAt', 'daysOfCover', 'velocity', 'healthScore', 'classification'];

const text = (max) => z.string().trim().min(1, 'Required').max(max);
const units = z.coerce.number().int().min(0).max(10_000_000);
const money = (min) => z.coerce.number().min(min).max(1_000_000).transform((n) => Math.round(n * 100) / 100);

/** Shared SKU field rules. Numeric fields use coercion so CSV strings validate the same way. */
export const skuShape = {
  sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, numbers, dot, dash or underscore').transform((s) => s.toUpperCase()),
  asin: z.string().trim().regex(/^[A-Za-z0-9]{10}$/, 'ASIN must be 10 letters or digits').transform((s) => s.toUpperCase()),
  name: text(200),
  category: text(60),
  supplier: text(120),
  unitCost: money(0),
  price: money(0.01),
  currentStock: units,
  inbound: units.default(0),
  reserved: units.default(0),
  unfulfillable: units.default(0),
  warehouse: text(40),
  marketplace: text(10).transform((s) => s.toUpperCase()).default('US'),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  safetyStock: units.default(0),
  reorderPoint: units.default(0),
  status: z.enum(SKU_STATUS).default('active'),
};

export const skuCreate = z.object(skuShape).strict();
export const skuImportRow = z.object(skuShape); // unknown CSV columns are ignored
export const skuPatch = z
  .object(Object.fromEntries(Object.entries(skuShape).map(([k, v]) => [k, v.optional()])))
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Provide at least one field to update');

const opt = z.string().trim().max(120).optional();
export const filterShape = {
  q: z.string().trim().max(100).optional(),
  category: opt, warehouse: opt, supplier: opt, marketplace: opt,
  risk: z.enum(RISK_KEYS).optional(),
  status: z.enum(SKU_STATUS).optional(),
};
export const filterQuery = z.object(filterShape);
export const skuListQuery = z.object({
  ...filterShape,
  sort: z.enum(SORT_FIELDS).default('sku'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().regex(/^\d{1,7}$/).optional(),
});
export const skuParams = z.object({ skuId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/) });
export const importBody = z.object({ rows: z.array(z.record(z.unknown())).min(1).max(500) });

/** CSV column order (snake_case) -> JSON field. Used by export and by the frontend importer. */
export const CSV_COLUMNS = [
  ['sku', 'sku'], ['asin', 'asin'], ['name', 'name'], ['category', 'category'], ['supplier', 'supplier'],
  ['unit_cost', 'unitCost'], ['selling_price', 'price'], ['current_stock', 'currentStock'], ['inbound_stock', 'inbound'],
  ['reserved_stock', 'reserved'], ['unfulfillable_stock', 'unfulfillable'], ['warehouse', 'warehouse'], ['marketplace', 'marketplace'],
  ['lead_time_days', 'leadTimeDays'], ['safety_stock', 'safetyStock'], ['reorder_point', 'reorderPoint'], ['status', 'status'],
];
