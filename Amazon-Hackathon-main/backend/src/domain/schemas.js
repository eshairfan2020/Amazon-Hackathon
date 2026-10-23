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
  barcode: z.union([z.literal(''), z.string().trim().regex(/^\d{8,14}$/, 'Barcode must be 8-14 digits (EAN/UPC)')]).default(''),
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
  ['lead_time_days', 'leadTimeDays'], ['safety_stock', 'safetyStock'], ['reorder_point', 'reorderPoint'], ['status', 'status'], ['barcode', 'barcode'],
];

// ---- barcode scan & stock adjustments
export const scanQuery = z.object({ code: z.string().trim().min(2).max(40) });
export const ADJUST_TYPES = ['receive', 'count', 'damaged'];
export const adjustBody = z
  .object({
    type: z.enum(ADJUST_TYPES),
    quantity: z.coerce.number().int().min(0).max(1_000_000),
    note: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine((b) => b.type === 'count' || b.quantity > 0, { message: 'Quantity must be greater than 0', path: ['quantity'] });
export const adjustmentsQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

// ---- AI business partner chat
export const chatBody = z
  .object({
    message: z.string().trim().min(1, 'Type a question').max(1000),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(10).default([]),
  })
  .strict();

// ---- orders, deliveries and customers
export const ORDER_STATUS = ['pending', 'shipped', 'delivered', 'returned', 'cancelled'];
const blank = (schema) => z.preprocess((v) => (v === '' || v == null ? undefined : v), schema.optional());
const dateStr = z.string().trim().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date (use YYYY-MM-DD)');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const orderListQuery = z.object({
  status: z.enum(ORDER_STATUS).optional(),
  q: z.string().trim().max(100).optional(),
  sku: z.string().trim().max(40).optional(),
  from: day.optional(), to: day.optional(),
  sort: z.enum(['placedAt', 'total', 'status']).default('placedAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().regex(/^\d{1,7}$/).optional(),
});
export const orderParams = z.object({ orderId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/) });
export const summaryQuery = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d), 'days must be 7, 30 or 90').default(30) });
export const customersQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
export const customerParams = z.object({ customerRef: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/) });
export const importOrdersBody = z.object({ rows: z.array(z.record(z.unknown())).min(1).max(500) });
/** One CSV row = one order line. Customer IDs must be anonymous (no names or emails). */
export const orderLineRow = z.object({
  orderNumber: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, . _ - only'),
  placedAt: dateStr,
  sku: z.string().trim().min(2).max(40).transform((s) => s.toUpperCase()),
  quantity: z.coerce.number().int().min(1).max(100000),
  unitPrice: blank(z.coerce.number().min(0).max(1_000_000)),
  status: blank(z.enum(ORDER_STATUS)),
  customerRef: blank(z.string().trim().max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use an anonymous customer ID (letters, numbers, - _), never a name or email')),
  carrier: blank(z.string().trim().max(40)),
  trackingRef: blank(z.string().trim().max(60)),
  shippedAt: blank(dateStr),
  deliveredAt: blank(dateStr),
});