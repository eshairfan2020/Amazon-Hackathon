/** Pure order analytics. Statuses: pending (not shipped), shipped (in transit), delivered, returned, cancelled. */
export const ORDER_STATUSES = ['pending', 'shipped', 'delivered', 'returned', 'cancelled'];
const DAY = 86_400_000;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const placed = (o) => Date.parse(o.placedAt);
export const orderUnits = (o) => o.lines.reduce((t, l) => t + l.quantity, 0);
const sells = (o) => o.status !== 'cancelled' && o.status !== 'returned';

export const windowOrders = (orders, nowMs, days) => orders.filter((o) => { const t = placed(o); return t >= nowMs - days * DAY && t <= nowMs; });

export function summarize(orders, nowMs, days) {
  const w = windowOrders(orders, nowMs, days);
  const by = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  let revenue = 0; let units = 0; let delivSum = 0; let delivN = 0; let parcelsShipped = 0; let parcelsDelivered = 0;
  const perDay = new Map(); const prod = new Map(); const bySku = new Map();
  for (const o of w) {
    by[o.status] += 1;
    if (o.shipment) {
      parcelsShipped += 1;
      if (o.shipment.deliveredAt) { parcelsDelivered += 1; delivSum += (Date.parse(o.shipment.deliveredAt) - placed(o)) / DAY; delivN += 1; }
    }
    if (sells(o)) {
      revenue += o.total; units += orderUnits(o);
      for (const l of o.lines) { const p = prod.get(l.sku) ?? { sku: l.sku, name: l.name, units: 0 }; p.units += l.quantity; prod.set(l.sku, p); }
    }
    const day = o.placedAt.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    for (const l of o.lines) { const s = bySku.get(l.sku) ?? { sku: l.sku, name: l.name, orders: 0, returned: 0 }; s.orders += 1; if (o.status === 'returned') s.returned += 1; bySku.set(l.sku, s); }
  }
  const series = [];
  for (let i = days; i >= 0; i -= 1) { const d = new Date(nowMs - i * DAY).toISOString().slice(0, 10); series.push({ date: d, orders: perDay.get(d) ?? 0 }); }
  return {
    days, received: w.length, pending: by.pending, inTransit: by.shipped, delivered: by.delivered, returned: by.returned, cancelled: by.cancelled,
    parcelsShipped, parcelsDelivered, returnRate: parcelsDelivered ? r1((by.returned / parcelsDelivered) * 100) : 0,
    revenue: r2(revenue), units, avgDeliveryDays: delivN ? r1(delivSum / delivN) : null,
    perDay: series,
    topProducts: [...prod.values()].sort((a, b) => b.units - a.units).slice(0, 5),
    returnsBySku: [...bySku.values()].filter((s) => s.returned > 0 && s.orders >= 5).map((s) => ({ ...s, rate: r1((s.returned / s.orders) * 100) })).sort((a, b) => b.returned - a.returned || b.rate - a.rate).slice(0, 5),
    demo: w.some((o) => o.demo),
  };
}

/** Customers are anonymous reference IDs only. */
export function customersFrom(orders) {
  const m = new Map();
  for (const o of orders) {
    if (!o.customerRef || o.status === 'cancelled') continue;
    const c = m.get(o.customerRef) ?? { customerRef: o.customerRef, orders: 0, units: 0, spend: 0, returned: 0, firstOrderAt: o.placedAt, lastOrderAt: o.placedAt };
    c.orders += 1;
    if (o.status === 'returned') c.returned += 1; else { c.units += orderUnits(o); c.spend += o.total; }
    if (o.placedAt < c.firstOrderAt) c.firstOrderAt = o.placedAt;
    if (o.placedAt > c.lastOrderAt) c.lastOrderAt = o.placedAt;
    m.set(o.customerRef, c);
  }
  const list = [...m.values()].map((c) => ({ ...c, spend: r2(c.spend) })).sort((a, b) => b.spend - a.spend);
  const repeat = list.filter((c) => c.orders >= 2).length;
  return { list, repeatRate: list.length ? r1((repeat / list.length) * 100) : 0 };
}