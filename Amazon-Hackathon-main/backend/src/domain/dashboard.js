import { startOfUtcDay } from './inventory.js';

const DAY = 86_400_000;
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);

/** items: SKUs enriched with `metrics`. salesBySku: Map skuId -> rows. */
export function buildDashboard(items, salesBySku, now) {
  const by = (key) => items.filter((i) => i.metrics.classification === key).length;
  const withCover = items.filter((i) => i.metrics.daysOfCover != null);

  const end = startOfUtcDay(now);
  const trend = [];
  const wanted = new Map();
  for (let d = 30; d >= 1; d -= 1) {
    const date = new Date(end - d * DAY).toISOString().slice(0, 10);
    const row = { date, units: 0 };
    trend.push(row);
    wanted.set(date, row);
  }
  for (const it of items) for (const r of salesBySku.get(it.skuId) ?? []) { const t = wanted.get(r.date); if (t) t.units += r.units; }

  const cats = new Map();
  for (const it of items) {
    const c = cats.get(it.category) ?? { category: it.category, units: 0, value: 0 };
    c.units += it.currentStock;
    c.value += it.metrics.inventoryValue;
    cats.set(it.category, c);
  }
  const brief = (i) => ({ skuId: i.skuId, sku: i.sku, name: i.name, classification: i.metrics.classification, daysOfCover: i.metrics.daysOfCover, stockoutDate: i.metrics.stockoutDate });

  return {
    totals: {
      totalSkus: items.length,
      inventoryValue: Math.round(sum(items, (i) => i.metrics.inventoryValue) * 100) / 100,
      lowStock: by('low_stock') + by('critical'),
      criticalStock: by('critical'),
      overstock: by('overstock'),
      slowMoving: by('slow_moving'),
      stranded: by('stranded'),
      inboundUnits: sum(items, (i) => i.inbound),
      healthScore: items.length ? Math.round(sum(items, (i) => i.metrics.healthScore) / items.length) : null,
    },
    charts: {
      stockByCategory: [...cats.values()].map((c) => ({ ...c, value: Math.round(c.value) })).sort((a, b) => b.units - a.units),
      lowestCover: withCover.slice().sort((a, b) => a.metrics.daysOfCover - b.metrics.daysOfCover).slice(0, 10).map(brief),
      velocityTop: items.slice().sort((a, b) => b.metrics.velocity - a.metrics.velocity).slice(0, 10).map((i) => ({ ...brief(i), velocity: i.metrics.velocity })),
      salesTrend: trend,
      stockoutForecast: items.filter((i) => i.metrics.stockoutDate && ['critical', 'low_stock'].includes(i.metrics.classification))
        .sort((a, b) => a.metrics.daysOfCover - b.metrics.daysOfCover).slice(0, 10).map(brief),
    },
  };
}
