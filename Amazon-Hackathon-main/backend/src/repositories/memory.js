import { conflict, notFound } from '../utils/errors.js';

/**
 * In-memory repository (demo store: data resets on restart). Every method is scoped by userId, so
 * one user can never read another user's rows. The relational target is in db/schema.sql.
 */
export function createMemoryRepository() {
  const users = new Map();
  const skus = new Map(); // `${userId}|${skuId}`
  const sales = new Map(); // `${userId}|${skuId}` -> [{date, units}]
  const audit = [];
  const adjustments = [];
  const orders = new Map(); // `${userId}|${orderId}`
  const k = (u, id) => `${u}|${id}`;
  const clone = (o) => (o == null ? o : structuredClone(o));
  const mine = (userId) => [...skus.values()].filter((s) => s.userId === userId);
  const byCode = (userId, code) => mine(userId).find((s) => s.sku === code) ?? null;

  return {
    kind: 'memory',
    async getUser(userId) { return clone(users.get(userId) ?? null); },
    async putUser(user) { users.set(user.userId, clone(user)); return clone(user); },
    async touchUser(userId, lastActiveAt) { const u = users.get(userId); if (u) u.lastActiveAt = lastActiveAt; },

    async createSku(sku) {
      if (byCode(sku.userId, sku.sku)) throw conflict('SKU_EXISTS', `SKU ${sku.sku} already exists`);
      skus.set(k(sku.userId, sku.skuId), clone(sku));
      return clone(sku);
    },
    async getSku(userId, skuId) { return clone(skus.get(k(userId, skuId)) ?? null); },
    async findSkuByCode(userId, code) { return clone(byCode(userId, code)); },
    async listSkus(userId) { return clone(mine(userId).sort((a, b) => (a.sku < b.sku ? -1 : 1))); },
    async countSkus(userId) { return mine(userId).length; },
    async updateSku(userId, skuId, patch) {
      const cur = skus.get(k(userId, skuId));
      if (!cur) throw notFound('SKU');
      if (patch.sku && patch.sku !== cur.sku && byCode(userId, patch.sku)) throw conflict('SKU_EXISTS', `SKU ${patch.sku} already exists`);
      const next = { ...cur, ...patch, skuId: cur.skuId, userId: cur.userId };
      skus.set(k(userId, skuId), next);
      return clone(next);
    },
    async deleteSku(userId, skuId) {
      sales.delete(k(userId, skuId));
      return skus.delete(k(userId, skuId));
    },

    async putSales(userId, skuId, rows) { sales.set(k(userId, skuId), clone(rows)); },
    async listSalesByUser(userId) {
      const out = new Map();
      for (const s of mine(userId)) out.set(s.skuId, clone(sales.get(k(userId, s.skuId)) ?? []));
      return out;
    },

    async addOrders(list) { for (const o of list) orders.set(k(o.userId, o.orderId), clone(o)); },
    async putOrder(o) { orders.set(k(o.userId, o.orderId), clone(o)); return clone(o); },
    async getOrder(userId, orderId) { return clone(orders.get(k(userId, orderId)) ?? null); },
    async findOrderByNumber(userId, number) { return clone([...orders.values()].find((o) => o.userId === userId && o.orderNumber === number) ?? null); },
    async listOrders(userId) { return clone([...orders.values()].filter((o) => o.userId === userId)); },
    async countOrders(userId) { return [...orders.values()].filter((o) => o.userId === userId).length; },

    async addAdjustment(entry) { adjustments.push(clone(entry)); },
    async listAdjustments(userId, { limit = 20 } = {}) {
      return clone(adjustments.filter((a) => a.userId === userId).slice(-limit).reverse());
    },

    async addAudit(entry) { audit.push(clone(entry)); },
    async listAudit(userId, { limit = 50 } = {}) {
      return clone(audit.filter((a) => a.userId === userId).slice(-limit).reverse());
    },
  };
}