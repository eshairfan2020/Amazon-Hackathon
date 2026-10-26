import { PRICING_DEFAULTS, breakEvenPrice, pricingPlan, priceForMargin, unitEconomics } from './pricing.js';

/**
 * Grounded assistant brain. Every number comes from the user's own computed inventory data
 * (no model guesses). Read-only: it explains and recommends, it never changes data.
 * The optional LLM only rewrites this draft in a friendlier voice.
 */
const STOP = new Set('the a an my of for to is are what how many much do i have me about on in and sell selling price cost margin profit stock at if should can you please it with this that pricing quantity units left we our all any'.split(' '));
const money = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9.%$\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter((t) => t.length >= 3 && !STOP.has(t));

export function findSku(message, items) {
  const m = norm(message);
  const code = m.match(/\b[a-z]{2,4}-\d{3,5}\b/);
  if (code) { const hit = items.find((i) => i.sku.toLowerCase() === code[0]); if (hit) return { sku: hit, codeToken: code[0] }; }
  const mt = new Set(toks(message));
  let best = null; let bestScore = 0; let tie = false;
  for (const it of items) {
    const nt = toks(it.name);
    const score = nt.filter((t) => mt.has(t)).length;
    if (score >= Math.min(2, nt.length) && score > 0) {
      if (score > bestScore) { best = it; bestScore = score; tie = false; } else if (score === bestScore) tie = true;
    }
  }
  return best && !tie ? { sku: best } : null;
}

export function parseNumbers(message, skuCode) {
  let m = norm(message);
  if (skuCode) m = m.replace(skuCode, ' ');
  const num = '\\$?(\\d+(?:\\.\\d+)?)';
  const pick = (re) => { const x = m.match(re); return x ? Number(x[1]) : null; };
  return {
    cost: pick(new RegExp(`(?:cost|costs|bought|buy|buying|purchase|purchased|paid)(?: it| them)?(?: for| at| is| of)? ?${num}`)),
    price: pick(new RegExp(`(?:sell|selling|price|priced|charge)(?: it| them)?(?: for| at| is| of| to)? ?${num}`)),
    feePct: pick(/(\d+(?:\.\d+)?) ?% ?(?:fee|fees|commission|referral)/) ?? pick(/(?:fee|fees|commission|referral)(?: is| are| of| at| about)? ?(\d+(?:\.\d+)?) ?%/),
    targetMarginPct: pick(/(\d+(?:\.\d+)?) ?% ?(?:margin|profit)/),
  };
}

const bullet = (s) => `- ${s}`;
const urgent = (i) => ['critical', 'low_stock'].includes(i.metrics.classification);

function summary(items) {
  const by = (k) => items.filter((i) => i.metrics.classification === k);
  const crit = by('critical'); const low = by('low_stock'); const over = by('overstock'); const slow = by('slow_moving'); const strand = by('stranded');
  const value = items.reduce((t, i) => t + i.metrics.inventoryValue, 0);
  const health = Math.round(items.reduce((t, i) => t + i.metrics.healthScore, 0) / items.length);
  const lines = [`Here is where your business stands. You track **${items.length} products** worth about **${money(value)}** at cost, with an average health score of **${health}/100**.`];
  if (crit.length + low.length) lines.push(`Needs attention first: **${crit.length} critical** and **${low.length} low-stock** products.`);
  if (over.length + slow.length + strand.length) lines.push(`Money tied up: ${over.length} overstocked, ${slow.length} slow-moving and ${strand.length} stranded products.`);
  if (!crit.length && !low.length) lines.push('Nothing is about to run out, which is a great place to be.');
  const top = crit[0] ?? low[0];
  const next = top ? `A good first step: restock **${top.name}** (${top.sku}); it has about ${top.metrics.daysOfCover} days of stock left.` : 'A good next step: look at your slow movers and see where cash is stuck.';
  return { reply: `${lines.join('\n\n')}\n\n${next}`, suggestions: ['What should I reorder today?', 'Which products are overstocked?', 'Which products have the lowest margin?'] };
}

function reorder(items) {
  const list = items.filter(urgent).sort((a, b) => (a.metrics.daysOfCover ?? 0) - (b.metrics.daysOfCover ?? 0)).slice(0, 5);
  if (!list.length) return { reply: 'Good news: none of your products are low on stock right now. I will flag them as soon as that changes.', suggestions: ['How is my inventory doing?', 'Which products are overstocked?'] };
  const cost = list.reduce((t, i) => t + i.metrics.recommendedReorderQty * i.unitCost, 0);
  const lines = list.map((i) => bullet(`**${i.name}** (${i.sku}): about ${i.metrics.daysOfCover} days left at ~${i.metrics.velocity} units/day. Order about **${i.metrics.recommendedReorderQty} units**${i.metrics.recommendedReorderDate ? ` by ${i.metrics.recommendedReorderDate}` : ''} (supplier lead time ${i.leadTimeDays} days).`));
  return {
    reply: `Here is what I would reorder first, most urgent at the top:\n\n${lines.join('\n')}\n\nThat is roughly **${money(cost)}** of purchases at your unit costs. These are estimates from your recent sales, so adjust for upcoming promotions or seasonality.`,
    suggestions: ['How is my inventory doing?', `How should I price ${list[0].name}?`],
    references: list.map((i) => ({ sku: i.sku, name: i.name })),
  };
}

function overstock(items) {
  const list = items.filter((i) => ['overstock', 'slow_moving', 'stranded'].includes(i.metrics.classification))
    .sort((a, b) => b.currentStock * b.unitCost - a.currentStock * a.unitCost).slice(0, 5);
  if (!list.length) return { reply: 'You have no overstocked or slow-moving products right now, so your cash is working well.', suggestions: ['What should I reorder today?'] };
  const tied = list.reduce((t, i) => t + i.currentStock * i.unitCost, 0);
  const lines = list.map((i) => bullet(`**${i.name}** (${i.sku}): ${i.currentStock} units (${money(i.currentStock * i.unitCost)} at cost), ${i.metrics.classificationLabel.toLowerCase()}.`));
  return {
    reply: `These products tie up the most cash:\n\n${lines.join('\n')}\n\nTogether that is about **${money(tied)}** sitting on shelves. A small promotion or a bundle can release it. Pick one and I will help you price it.`,
    suggestions: [`How should I price ${list[0].name}?`, 'What should I reorder today?'],
    references: list.map((i) => ({ sku: i.sku, name: i.name })),
  };
}

function productInfo(i) {
  const m = i.metrics;
  return {
    reply: `**${i.name}** (${i.sku}): you have **${i.currentStock} units** ready to sell, ${i.inbound} on the way, ${i.reserved} reserved and ${i.unfulfillable} unfulfillable.\n\nAt about ${m.velocity} units/day that is ${m.daysOfCover == null ? 'no recent sales to measure cover' : `roughly ${m.daysOfCover} days of stock`}. Status: **${m.classificationLabel}**. ${m.explanation}`,
    suggestions: [`How should I price ${i.name}?`, 'What should I reorder today?'],
    references: [{ sku: i.sku, name: i.name }],
  };
}

function lowMargin(all, feePct) {
  const items = all.filter((i) => !i.needsDetails && i.price > 0);
  const rows = items.map((i) => ({ i, e: unitEconomics({ price: i.price, cost: i.unitCost, feePct }) })).sort((a, b) => a.e.marginPct - b.e.marginPct).slice(0, 5);
  const lines = rows.map(({ i, e }) => bullet(`**${i.name}** (${i.sku}): margin **${e.marginPct}%**, profit ${money(e.unitProfit)} per unit.`));
  return {
    reply: `These products have your thinnest margins (assuming ${feePct}% Amazon fees, tell me your real fees if different):\n\n${lines.join('\n')}\n\nA small price rise or a cheaper supplier on these gives the biggest profit gain.`,
    suggestions: [`How should I price ${rows[0].i.name}?`, 'How much profit is in my stock?'],
    references: rows.map(({ i }) => ({ sku: i.sku, name: i.name })),
  };
}

function profitInStock(all, feePct) {
  const items = all.filter((i) => !i.needsDetails && i.price > 0);
  const total = items.reduce((t, i) => t + Math.max(0, i.currentStock) * unitEconomics({ price: i.price, cost: i.unitCost, feePct }).unitProfit, 0);
  return { reply: `If you sold every sellable unit at today's prices, I estimate about **${money(total)}** profit after costs and a ${feePct}% fee assumption. It is a ceiling, not a forecast: slow movers will take time or discounts to sell.`, suggestions: ['Which products have the lowest margin?', 'Which products are overstocked?'] };
}

function pricing(message, items, found, nums) {
  const feePct = nums.feePct ?? PRICING_DEFAULTS.referralFeePct;
  const cfg = { ...PRICING_DEFAULTS, ...(nums.targetMarginPct ? { targetMarginPct: nums.targetMarginPct } : {}) };
  const feeNote = nums.feePct ? '' : `\n\nI assumed a ${feePct}% Amazon fee and no fulfillment fee. Tell me your real fees (for example "fees are 18%") and I will recalculate.`;
  const sku = found?.sku;
  const cost = nums.cost ?? sku?.unitCost;
  const price = nums.price ?? sku?.price;

  if (cost == null) {
    return { reply: 'Happy to help you price it. Tell me the product (or its cost) and I will work out your profit and a sensible selling price. For example: "cost 10, sell at 25".', suggestions: ['Which products have the lowest margin?', ...items.slice(0, 2).map((i) => `How should I price ${i.name}?`)] };
  }
  const target = priceForMargin({ cost, marginPct: cfg.targetMarginPct, feePct });
  const be = breakEvenPrice({ cost, feePct });
  if (price == null) {
    return { reply: `With a cost of **${money(cost)}**, you break even at **${money(be)}**. To earn a ${cfg.targetMarginPct}% margin you would sell at about **${money(target)}**. What price are you thinking of?${feeNote}`, suggestions: [`If I sell at ${money(Math.ceil(target))}, what is my profit?`] };
  }
  const plan = sku ? pricingPlan({ classification: sku.metrics.classification, price, cost, feePct, cfg }) : pricingPlan({ classification: 'healthy', price, cost, feePct, cfg });
  const e = plan.options[0];
  const who = sku ? `**${sku.name}** (${sku.sku})` : 'This product';
  const verdict = e.unitProfit <= 0 ? 'At this price you would lose money on every sale.' : `You keep about **${money(e.unitProfit)}** per unit, a **${e.marginPct}%** margin.`;
  const strategy = sku ? `\n\n${plan.headline} ${plan.rationale}` : '';
  const stockLine = sku && sku.currentStock > 0 ? `\n\nOn your ${sku.currentStock} units that is roughly **${money(sku.currentStock * Math.max(0, e.unitProfit))}** of potential profit.` : '';
  return {
    reply: `${who} at ${money(price)} with a cost of ${money(cost)}: fees take about ${money(e.fees)}. ${verdict} You break even at ${money(plan.breakEven)}.${strategy}${stockLine}${feeNote}`,
    card: { type: 'pricing', title: sku ? `${sku.name} pricing` : 'Pricing scenarios', feePct, breakEven: plan.breakEven, options: plan.options },
    suggestions: sku ? ['What should I reorder today?', 'Which products have the lowest margin?'] : ['Which products have the lowest margin?'],
    references: sku ? [{ sku: sku.sku, name: sku.name }] : [],
  };
}

function ordersReply(message, o) {
  if (!o?.hasOrders) return { reply: 'I do not see any orders yet. Orders appear here once you import them (Orders page, Import CSV) or load the demo data in Settings.', suggestions: [] };
  const t = norm(message);
  const win = /\b(week|7 days)\b/.test(t) ? 7 : /\b(quarter|90)\b/.test(t) ? 90 : 30;
  const w = o[`w${win}`];
  const label = win === 7 ? 'the last 7 days' : `the last ${win} days`;
  const demo = w.demo ? '\n\n(These are synthetic demo orders.)' : '';
  const chips = ['How many orders were delivered this week?', 'Which products get returned most?', 'Who are my best customers?'];
  if (/return/.test(t)) {
    if (!w.returnsBySku.length) return { reply: `In ${label} I see ${w.returned} returned orders, and no single product stands out yet.${demo}`, suggestions: chips };
    const lines = w.returnsBySku.map((r) => bullet(`**${r.name}** (${r.sku}): ${r.returned} of ${r.orders} orders returned (${r.rate}%).`));
    return { reply: `Over ${label}, **${w.returned} orders** were returned (${w.returnRate}% of delivered parcels). Products returned most often:\n\n${lines.join('\n')}\n\nCheck the listing, packaging and supplier quality on the top one first.${demo}`, suggestions: chips, references: w.returnsBySku.map((r) => ({ sku: r.sku, name: r.name })) };
  }
  if (/customer|buyer|repeat|loyal/.test(t)) {
    const lines = o.topCustomers.map((c) => bullet(`**${c.customerRef}**: ${c.orders} order${c.orders === 1 ? "" : "s"}, ${money(c.spend)} spent.`));
    return { reply: `You have **${o.totalCustomers} customers** on record and **${o.repeatRate}%** of them ordered more than once. Your top customers by spend:\n\n${lines.join('\n')}\n\nCustomers are anonymous IDs, so I never see names or addresses. A thank-you offer or bundle for repeat buyers is a cheap way to grow sales.${demo}`, suggestions: chips };
  }
  const avg = w.avgDeliveryDays == null ? '' : ` Parcels take about **${w.avgDeliveryDays} days** from order to delivery.`;
  return {
    reply: `In ${label} you received **${w.received} orders**.\n\n${[`**${w.parcelsDelivered}** parcels delivered to customers`, `**${w.inTransit}** in transit`, `**${w.pending}** waiting to ship`, `**${w.returned}** returned and **${w.cancelled}** cancelled`].map(bullet).join('\n')}\n\nRevenue after cancellations and returns is about **${money(w.revenue)}** from ${w.units} units.${avg}${demo}`,
    suggestions: chips,
  };
}

const HELP = {
  reply: 'Hi! I am your inventory and pricing partner. I look at your real stock and sales numbers and help you decide what to do next. I can:\n\n- Check how your inventory is doing\n- Tell you what to reorder and when\n- Spot overstock that is tying up your cash\n- Look up how many units of any product you have\n- Work out profit margins and suggest prices\n- Summarise orders, deliveries, returns and repeat customers\n\nWhat would you like to start with?',
  suggestions: ['How is my inventory doing?', 'What should I reorder today?', 'Which products are overstocked?', 'Which products have the lowest margin?', 'How many orders were delivered this week?'],
};

export function buildReply(message, items, orders) {
  const text = norm(message);
  if (!items.length) {
    return { intent: 'empty', reply: 'I do not see any products in your inventory yet. Add your first product on the SKUs page (or import a CSV, or load the demo data in Settings) and I will start analysing it right away.', suggestions: [] };
  }
  const found = findSku(message, items);
  const nums = parseNumbers(message, found?.codeToken);
  const feePct = nums.feePct ?? PRICING_DEFAULTS.referralFeePct;
  const has = (re) => re.test(text);

  let intent;
  let out;
  if (has(/^(hi|hello|hey|salam|assalam)\b|\bhelp\b|what can you do/) && text.length < 40) { intent = 'help'; out = HELP; }
  else if (has(/low margin|lowest margin|thin margin|best margin|worst margin|margins?\b.*\b(all|every|products)/)) { intent = 'margins'; out = lowMargin(items, feePct); }
  else if (has(/(how much|total|all).*(profit|earn)|profit.*(stock|inventory)/) && !found) { intent = 'profit'; out = profitInStock(items, feePct); }
  else if (has(/\borders\b|order history|parcel|deliver|shipment|shipped|in transit|returned|returns?\b|cancel|customer|buyer|repeat/)) { intent = 'orders'; out = ordersReply(message, orders); }
  else if (has(/\b(price|pricing|margin|profit|cost|costs|sell|selling|markup|discount|worth)\b/)) { intent = 'pricing'; out = pricing(message, items, found, nums); }
  else if (has(/reorder|restock|order more|running out|run out|stock ?out|low stock|short on|critical|what (should|do) i (buy|order)/)) { intent = 'reorder'; out = reorder(items); }
  else if (has(/overstock|excess|too much|slow|dead stock|stranded|not selling|clearance|tied up/)) { intent = 'overstock'; out = overstock(items); }
  else if (found) { intent = 'product'; out = productInfo(found.sku); }
  else if (has(/summary|overview|how.*(doing|business|inventory)|health|status|insight|report|where do i stand/)) { intent = 'summary'; out = summary(items); }
  else { intent = 'fallback'; out = { reply: 'I am not sure I got that, but I can help with stock levels, reorders, overstock, margins and pricing. Try one of these:', suggestions: HELP.suggestions }; }
  return { intent, references: [], ...out };
}