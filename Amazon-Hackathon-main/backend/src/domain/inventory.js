/**
 * Inventory risk engine. Pure functions, no I/O. Every number is an ESTIMATE from recent sales;
 * every classification carries a plain-language explanation.
 *
 * Assumptions (documented so users can challenge them):
 *  - Sales rows are one per day (zero-sale days stored as 0), oldest first, ending yesterday.
 *  - Velocity = 60% of the 30-day average + 40% of the 90-day average (units/day).
 *  - "Sellable" stock = currentStock (fulfillable). Inbound is counted separately in "position".
 *  - Reorder point = velocity x lead time + safety stock.
 *  - Recommended order = enough to cover (lead time + target cover days) + safety stock, minus position.
 */
export const DEFAULT_INVENTORY_CONFIG = Object.freeze({
  criticalDays: 7,
  targetCoverDays: 45,
  overstockDays: 120,
  slowMovingVelocity: 0.3,
  slowMovingMinCover: 90,
  velocityWeight30: 0.6,
});

export function mergeInventoryConfig(overrides = {}) {
  const out = { ...DEFAULT_INVENTORY_CONFIG };
  for (const key of Object.keys(out)) {
    const v = overrides?.[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return Object.freeze(out);
}

export const CLASS_LABELS = Object.freeze({
  healthy: 'Healthy',
  low_stock: 'Low Stock',
  critical: 'Critical Stockout Risk',
  overstock: 'Overstock',
  slow_moving: 'Slow Moving',
  stranded: 'Stranded Inventory',
});

const DAY = 86_400_000;
const round = (n, d = 2) => { const f = 10 ** d; return Math.round(n * f) / f; };
export const startOfUtcDay = (ms) => Math.floor(ms / DAY) * DAY;
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Sum and row-count of sales inside the `days` full UTC days before today. */
export function windowStats(rows, now, days) {
  const end = startOfUtcDay(now);
  const start = end - days * DAY;
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    const ms = Date.parse(r.date);
    if (ms >= start && ms < end) { sum += r.units; count += 1; }
  }
  return { sum, count };
}

export function computeMetrics(sku, rows, now, cfg = DEFAULT_INVENTORY_CONFIG) {
  const w30 = windowStats(rows, now, 30);
  const w90 = windowStats(rows, now, 90);
  const v30 = w30.count ? w30.sum / w30.count : 0;
  const v90 = w90.count ? w90.sum / w90.count : v30;
  const velocity = round(cfg.velocityWeight30 * v30 + (1 - cfg.velocityWeight30) * v90, 2);

  const sellable = sku.currentStock;
  const position = sellable + sku.inbound;
  const lead = sku.leadTimeDays;
  const daysOfCover = velocity > 0 ? round(sellable / velocity, 1) : null;
  const coverWithInbound = velocity > 0 ? round(position / velocity, 1) : null;

  const reorderPoint = Math.ceil(velocity * lead + sku.safetyStock);
  const targetPosition = Math.ceil(velocity * (lead + cfg.targetCoverDays) + sku.safetyStock);
  const recommendedReorderQty = sku.status === 'active' ? Math.max(0, targetPosition - position) : 0;

  let recommendedReorderDate = null;
  if (velocity > 0 && sku.status === 'active') {
    const daysUntil = (position - reorderPoint) / velocity;
    if (daysUntil <= 0) recommendedReorderDate = isoDate(now);
    else if (daysUntil <= 365) recommendedReorderDate = isoDate(now + Math.floor(daysUntil) * DAY);
  }
  const stockoutDate = daysOfCover == null || daysOfCover > 365 ? null : isoDate(now + Math.floor(daysOfCover) * DAY);

  let cls = 'healthy';
  if (sku.status === 'stranded' || (sku.status === 'inactive' && sellable > 0)) cls = 'stranded';
  else if (velocity > 0 && daysOfCover <= cfg.criticalDays && (coverWithInbound <= lead || sellable === 0)) cls = 'critical';
  else if (velocity > 0 && position <= reorderPoint) cls = 'low_stock';
  else if (v30 < cfg.slowMovingVelocity && sellable > 0 && (daysOfCover == null || daysOfCover >= cfg.slowMovingMinCover)) cls = 'slow_moving';
  else if (velocity > 0 && coverWithInbound > cfg.overstockDays) cls = 'overstock';

  let stockoutRisk = 'none';
  if (cls === 'critical') stockoutRisk = 'high';
  else if (cls === 'low_stock') stockoutRisk = 'medium';
  else if (cls === 'healthy' && velocity > 0 && coverWithInbound <= lead + 14) stockoutRisk = 'low';

  let overstockRisk = 'none';
  if (cls === 'overstock') overstockRisk = coverWithInbound > cfg.overstockDays * 1.5 ? 'high' : 'medium';
  else if (cls === 'slow_moving') overstockRisk = 'high';
  else if (velocity > 0 && coverWithInbound > 90) overstockRisk = 'low';

  const total = sellable + sku.unfulfillable;
  const unfulfillablePenalty = total > 0 ? Math.min(10, Math.round((sku.unfulfillable / total) * 100)) : 0;
  const base = { healthy: 100, low_stock: 62, critical: 20, overstock: 58, slow_moving: 45, stranded: 35 }[cls];
  const overstockPenalty = cls === 'overstock' ? Math.min(20, Math.round(((coverWithInbound - cfg.overstockDays) / cfg.overstockDays) * 20)) : 0;
  const healthScore = Math.max(0, Math.min(100, base - unfulfillablePenalty - overstockPenalty));

  const explanation = explain({ cls, sku, velocity, v30, daysOfCover, coverWithInbound, reorderPoint, recommendedReorderQty, recommendedReorderDate, cfg, position });

  return {
    velocity, velocity30: round(v30, 2), velocity90: round(v90, 2),
    daysOfCover, daysOfCoverWithInbound: coverWithInbound, stockoutDate,
    reorderPointRecommended: reorderPoint, recommendedReorderQty, recommendedReorderDate,
    stockoutRisk, overstockRisk, classification: cls, classificationLabel: CLASS_LABELS[cls],
    healthScore, inventoryValue: round((sku.currentStock + sku.reserved) * sku.unitCost, 2), explanation,
  };
}

function explain(c) {
  const { cls, sku, velocity, v30, daysOfCover: dc, coverWithInbound: dcp, reorderPoint: rop, recommendedReorderQty: qty, recommendedReorderDate: date, cfg, position } = c;
  const inb = sku.inbound > 0 ? ` ${sku.inbound} units are inbound, but they may not arrive in time.` : '';
  switch (cls) {
    case 'critical':
      return (sku.currentStock === 0 ? 'This item is out of stock' : `Only about ${dc} days of stock are left`) +
        ` at roughly ${velocity} units/day, and restocking takes ${sku.leadTimeDays} days, so sales are likely to be lost before new stock lands.${inb} Reorder about ${qty} units now. (Estimate based on recent sales.)`;
    case 'low_stock':
      return `Stock plus inbound (${position} units) is at or below the reorder point of ${rop} units (demand during the ${sku.leadTimeDays}-day lead time plus ${sku.safetyStock} units of safety stock). Reorder about ${qty} units${date ? ` by ${date}` : ''} to avoid a stockout. (Estimate.)`;
    case 'overstock':
      return `You hold about ${dcp} days of cover, well above the ${cfg.overstockDays}-day target at ~${velocity} units/day. Hold off on reordering and consider a promotion to free up cash and cut storage fees. (Estimate.)`;
    case 'slow_moving':
      return `This item sells only about ${round(v30, 2)} units/day while ${sku.currentStock} units sit in stock${dc ? ` (~${Math.round(dc)} days of cover)` : ''}. Consider discounting, bundling or a removal order. (Estimate.)`;
    case 'stranded':
      return `This item is marked ${sku.status}, so ${sku.currentStock} sellable units are not generating sales. Fix the listing or request removal, and do not reorder until it is active again.`;
    default:
      return velocity > 0
        ? `About ${dc} days of cover at ~${velocity} units/day, comfortably above the ${rop}-unit reorder point. No action needed. (Estimate.)`
        : 'No recent sales and no stock on hand, so there is nothing to act on yet.';
  }
}
