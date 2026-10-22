/**
 * Pricing math. Pure functions. Fee numbers are ASSUMPTIONS the user can override in chat
 * (Amazon fees vary by category and size). No competitor or demand-elasticity data is used.
 */
export const PRICING_DEFAULTS = Object.freeze({ referralFeePct: 15, fulfillmentFee: 0, targetMarginPct: 25, minMarginPct: 8 });
const r2 = (n) => Math.round(n * 100) / 100;

export function unitEconomics({ price, cost, feePct, fulfillmentFee = 0 }) {
  const fees = r2((price * feePct) / 100 + fulfillmentFee);
  const unitProfit = r2(price - cost - fees);
  return {
    price: r2(price), cost: r2(cost), fees, unitProfit,
    marginPct: price > 0 ? r2((unitProfit / price) * 100) : null,
    markupPct: cost > 0 ? r2((unitProfit / cost) * 100) : null,
  };
}

/** Lowest price with zero profit after fees. */
export function breakEvenPrice({ cost, feePct, fulfillmentFee = 0 }) {
  const d = 1 - feePct / 100;
  return d > 0 ? r2((cost + fulfillmentFee) / d) : null;
}

/** Price that yields `marginPct` profit margin after fees. Null when impossible. */
export function priceForMargin({ cost, marginPct, feePct, fulfillmentFee = 0 }) {
  const d = 1 - feePct / 100 - marginPct / 100;
  return d > 0 ? r2((cost + fulfillmentFee) / d) : null;
}

/** Strategy options tailored to the SKU's inventory situation. */
export function pricingPlan({ classification, price, cost, feePct, fulfillmentFee, cfg = PRICING_DEFAULTS }) {
  const eco = (p) => unitEconomics({ price: p, cost, feePct, fulfillmentFee });
  const floor = priceForMargin({ cost, marginPct: cfg.minMarginPct, feePct, fulfillmentFee });
  const target = priceForMargin({ cost, marginPct: cfg.targetMarginPct, feePct, fulfillmentFee });
  const options = [{ key: 'current', label: 'Current price', ...eco(price) }];
  let headline;
  let rationale;

  if (classification === 'overstock' || classification === 'slow_moving') {
    const promo = r2(Math.max(floor ?? 0, price * 0.9));
    if (promo < price) options.push({ key: 'promo', label: 'Promo (about -10%)', ...eco(promo) });
    if (floor && floor < price && floor !== promo) options.push({ key: 'floor', label: `Lowest sensible price (${cfg.minMarginPct}% margin)`, ...eco(floor) });
    headline = 'You hold more than you sell, so a measured price cut can free up cash.';
    rationale = 'I cannot predict how many extra units a discount would sell (I have no price-vs-demand data), so start small and watch the sales speed.';
  } else if (classification === 'critical' || classification === 'low_stock') {
    options.push({ key: 'hold', label: 'Hold margin (about +5%)', ...eco(r2(price * 1.05)) });
    headline = 'Stock is tight, so avoid discounts until you restock.';
    rationale = 'A small price increase can stretch the units you have left. I have no competitor price data, so test it and watch your sales.';
  } else if (classification === 'stranded') {
    headline = 'This item is not active, so fix the listing before changing the price.';
    rationale = 'Pricing will not help until the item can sell again.';
  } else {
    const cur = eco(price);
    if (target && cur.marginPct != null && cur.marginPct < cfg.targetMarginPct && target > price) options.push({ key: 'target', label: `Reach ${cfg.targetMarginPct}% margin`, ...eco(target) });
    headline = cur.marginPct != null && cur.marginPct >= cfg.targetMarginPct ? 'Your price looks healthy, so I would keep it.' : 'Your margin is below the usual target, so consider a small increase.';
    rationale = 'Stock levels are balanced, which gives you room to test small price changes.';
  }
  return { headline, rationale, breakEven: breakEvenPrice({ cost, feePct, fulfillmentFee }), options };
}