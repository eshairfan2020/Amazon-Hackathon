import { buildReply } from '../domain/assistant.js';

/** Chat service: grounded draft from the user's own data, optionally polished by the AI provider. Read-only. */
export function createAssistantService({ skus, ai, orders }) {
  return {
    async chat(userId, { message, history = [] }) {
      const { items } = await skus.enriched(userId);
      const stats = await orders.assistantStats(userId);
      const draft = buildReply(message, items, stats);
      const base = { reply: draft.reply, suggestions: draft.suggestions.slice(0, 4), references: draft.references ?? [], card: draft.card ?? null, intent: draft.intent };
      if (ai.mode === 'bedrock' && draft.intent !== 'empty') {
        try {
          const data = {
            catalogSize: items.length,
            orders: stats.hasOrders ? { last30Days: { received: stats.w30.received, delivered: stats.w30.parcelsDelivered, inTransit: stats.w30.inTransit, returned: stats.w30.returned, revenue: stats.w30.revenue } } : null,
            focus: (draft.references ?? []).map((r) => items.find((i) => i.sku === r.sku)).filter(Boolean)
              .map((i) => ({ sku: i.sku, name: i.name, stock: i.currentStock, inbound: i.inbound, price: i.price, cost: i.unitCost, status: i.metrics.classificationLabel })),
          };
          const text = await ai.rewrite({ message, history, draft: draft.reply, data });
          if (text) return { ...base, reply: text, source: 'bedrock', fallback: false };
        } catch {
          return { ...base, source: 'builtin', fallback: true };
        }
      }
      return { ...base, source: 'builtin', fallback: false };
    },
  };
}