import { startOfUtcDay } from '../domain/inventory.js';

const DAY = 86_400_000;
const CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL'];
const round2 = (n) => Math.round(n * 100) / 100;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * SYNTHETIC orders built from the last 30 days of each SKU's sales rows, so units ordered equal units sold.
 * Customers are anonymous IDs (CUST-xxxx); about a quarter of customers order more than once. Everything is flagged demo: true.
 */
export async function seedOrders(repo, userId, made, nowMs) {
  const rand = rng(424242);
  const end = startOfUtcDay(nowMs);
  const orders = [];
  let counter = 100000;
  for (let d = 30; d >= 1; d -= 1) {
    const dayStart = end - d * DAY;
    const date = new Date(dayStart).toISOString().slice(0, 10);
    const pool = made.map(({ sku, rows }) => ({ sku, left: rows.find((r) => r.date === date)?.units ?? 0 })).filter((p) => p.left > 0);
    while (pool.length) {
      const lines = [];
      const want = rand() < 0.3 ? 2 : 1;
      for (let k = 0; k < want; k += 1) {
        const cand = pool.filter((p) => !lines.some((l) => l.skuId === p.sku.skuId));
        if (!cand.length) break;
        const p = cand[Math.floor(rand() * cand.length)];
        const quantity = Math.min(p.left, 1 + Math.floor(rand() * 3));
        lines.push({ skuId: p.sku.skuId, sku: p.sku.sku, name: p.sku.name, quantity, unitPrice: p.sku.price });
        p.left -= quantity;
        if (p.left === 0) pool.splice(pool.indexOf(p), 1);
      }
      const placedMs = dayStart + Math.floor(rand() * DAY);
      let status = 'pending';
      let shipment = null;
      if (rand() < 0.03) status = 'cancelled';
      else {
        const shippedMs = placedMs + (0.3 + rand() * 1.2) * DAY;
        if (shippedMs <= nowMs) {
          const deliveredMs = shippedMs + (2 + rand() * 3.5) * DAY;
          const carrier = CARRIERS[Math.floor(rand() * CARRIERS.length)];
          shipment = { carrier, trackingRef: `${carrier.slice(0, 2).toUpperCase()}${String(Math.floor(rand() * 1e10)).padStart(10, '0')}`, shippedAt: new Date(shippedMs).toISOString(), deliveredAt: null };
          status = 'shipped';
          if (deliveredMs <= nowMs) { shipment.deliveredAt = new Date(deliveredMs).toISOString(); status = rand() < 0.05 ? 'returned' : 'delivered'; }
        }
      }
      const stamp = new Date(placedMs).toISOString();
      orders.push({
        orderId: `ord_demo_${counter}`, userId, orderNumber: `ORD-${counter}`, customerRef: `CUST-${1001 + Math.floor(8000 * rand())}`, channel: 'demo',
        placedAt: stamp, status, lines, total: round2(lines.reduce((t, l) => t + l.quantity * l.unitPrice, 0)), shipment, demo: true, createdAt: stamp, updatedAt: stamp,
      });
      counter += 1;
    }
  }
  await repo.addOrders(orders);
  return orders.length;
}