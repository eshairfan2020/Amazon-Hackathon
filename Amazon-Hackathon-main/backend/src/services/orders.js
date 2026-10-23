import { newId } from '../utils/ids.js';
import { notFound } from '../utils/errors.js';
import { customersFrom, summarize } from '../domain/orders.js';
import { orderLineRow } from '../domain/schemas.js';

const round2 = (n) => Math.round(n * 100) / 100;
const iso = (s) => new Date(s).toISOString();

export function createOrderService({ repo, clock, audit }) {
  return {
    async list(userId, q) {
      const all = await repo.listOrders(userId);
      const needle = q.q?.toLowerCase();
      const sku = q.sku?.toUpperCase();
      const rows = all.filter((o) =>
        (!q.status || o.status === q.status) &&
        (!sku || o.lines.some((l) => l.sku === sku)) &&
        (!q.from || o.placedAt.slice(0, 10) >= q.from) && (!q.to || o.placedAt.slice(0, 10) <= q.to) &&
        (!needle || o.orderNumber.toLowerCase().includes(needle) || (o.customerRef || '').toLowerCase().includes(needle) || o.lines.some((l) => l.sku.toLowerCase().includes(needle) || l.name.toLowerCase().includes(needle))));
      const sign = q.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => (a[q.sort] < b[q.sort] ? -1 : a[q.sort] > b[q.sort] ? 1 : a.orderNumber < b.orderNumber ? -1 : 1) * sign);
      const start = q.cursor ? Number.parseInt(q.cursor, 10) : 0;
      return { items: rows.slice(start, start + q.limit), total: rows.length, nextCursor: start + q.limit < rows.length ? String(start + q.limit) : null };
    },

    async get(userId, orderId) {
      const o = await repo.getOrder(userId, orderId);
      if (!o) throw notFound('Order');
      return o;
    },

    async summary(userId, days) { return summarize(await repo.listOrders(userId), clock(), days); },

    async customers(userId, { limit }) {
      const { list, repeatRate } = customersFrom(await repo.listOrders(userId));
      return { customers: list.slice(0, limit), totalCustomers: list.length, repeatRate };
    },

    async customerHistory(userId, customerRef) {
      const orders = (await repo.listOrders(userId)).filter((o) => o.customerRef === customerRef).sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));
      if (!orders.length) throw notFound('Customer');
      const profile = customersFrom(orders).list[0] ?? { customerRef, orders: 0, units: 0, spend: 0, returned: 0 };
      return { profile, orders: orders.slice(0, 50) };
    },

    /** Compact stats for the AI partner (read-only). */
    async assistantStats(userId) {
      const orders = await repo.listOrders(userId);
      if (!orders.length) return { hasOrders: false };
      const now = clock();
      const { list, repeatRate } = customersFrom(orders);
      return { hasOrders: true, w7: summarize(orders, now, 7), w30: summarize(orders, now, 30), w90: summarize(orders, now, 90), topCustomers: list.slice(0, 5), totalCustomers: list.length, repeatRate };
    },

    /** Upsert by order number. One CSV row = one line; header fields come from the first row of each order. */
    async importRows(userId, rows) {
      const skus = new Map((await repo.listSkus(userId)).map((s) => [s.sku, s]));
      const groups = new Map();
      const failed = [];
      rows.forEach((raw, i) => {
        const num = String(raw?.orderNumber ?? '').trim();
        if (!num) { failed.push({ orderNumber: `row ${i + 1}`, errors: ['orderNumber: Required'] }); return; }
        if (!groups.has(num)) groups.set(num, []);
        groups.get(num).push(raw);
      });
      let created = 0; let updated = 0;
      for (const [num, lineRows] of groups) {
        const errors = [];
        const parsed = lineRows.map((r) => orderLineRow.safeParse(r));
        parsed.forEach((p, i) => { if (!p.success) p.error.issues.forEach((x) => errors.push(`line ${i + 1} ${x.path.join('.')}: ${x.message}`)); });
        if (errors.length) { failed.push({ orderNumber: num, errors }); continue; }
        const lines = parsed.map((p) => p.data);
        const head = lines[0];
        const outLines = [];
        for (const l of lines) {
          const sku = skus.get(l.sku);
          if (!sku) { errors.push(`sku: Unknown SKU ${l.sku}. Add the product first.`); continue; }
          outLines.push({ skuId: sku.skuId, sku: sku.sku, name: sku.name, quantity: l.quantity, unitPrice: l.unitPrice ?? sku.price });
        }
        const status = head.status ?? (head.deliveredAt ? 'delivered' : head.shippedAt ? 'shipped' : 'pending');
        const t = (s) => (s ? Date.parse(s) : null);
        if (['shipped', 'delivered'].includes(status) && !head.shippedAt) errors.push(`status ${status} needs shippedAt`);
        if (status === 'delivered' && !head.deliveredAt) errors.push('status delivered needs deliveredAt');
        if (t(head.shippedAt) != null && t(head.shippedAt) < t(head.placedAt)) errors.push('shippedAt is before placedAt');
        if (t(head.deliveredAt) != null && (t(head.shippedAt) == null || t(head.deliveredAt) < t(head.shippedAt))) errors.push('deliveredAt must come after shippedAt');
        if (errors.length) { failed.push({ orderNumber: num, errors }); continue; }

        const existing = await repo.findOrderByNumber(userId, num);
        const stamp = new Date(clock()).toISOString();
        const shipment = head.shippedAt ? { carrier: head.carrier ?? '', trackingRef: head.trackingRef ?? '', shippedAt: iso(head.shippedAt), deliveredAt: head.deliveredAt ? iso(head.deliveredAt) : null } : null;
        await repo.putOrder({
          orderId: existing?.orderId ?? newId('ord'), userId, orderNumber: num, customerRef: head.customerRef ?? '', channel: 'import',
          placedAt: iso(head.placedAt), status, lines: outLines, total: round2(outLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)),
          shipment, demo: false, createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
        });
        if (existing) updated += 1; else created += 1;
      }
      await audit.record(userId, 'orders.import', 'order', 'bulk', `Import: ${created} created, ${updated} updated, ${failed.length} failed`);
      return { created, updated, failed };
    },
  };
}