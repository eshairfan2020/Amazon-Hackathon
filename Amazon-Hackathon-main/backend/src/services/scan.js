import { newId } from '../utils/ids.js';
import { notFound, unprocessable } from '../utils/errors.js';

const isDigits = (s) => /^\d+$/.test(s);
const stripZeros = (s) => s.replace(/^0+/, '');
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Barcode lookup + physical stock adjustments (receive shipment, cycle count, mark damaged).
 * Every adjustment keeps before/after values, is audited, and immediately changes the risk metrics.
 */
export function createScanService({ repo, clock, audit, skus }) {
  /** Matches SKU code, ASIN or barcode. UPC-A (12 digits) equals EAN-13 with a leading zero. */
  function matches(sku, raw) {
    const code = raw.trim();
    const up = code.toUpperCase();
    if (sku.sku === up || sku.asin === up) return true;
    return Boolean(sku.barcode) && isDigits(code) && stripZeros(sku.barcode) === stripZeros(code);
  }
  const snap = (s) => ({ currentStock: s.currentStock, inbound: s.inbound, unfulfillable: s.unfulfillable });

  return {
    async lookup(userId, code) {
      const found = (await repo.listSkus(userId)).find((s) => matches(s, code));
      if (!found) throw notFound('SKU for this code');
      return skus.get(userId, found.skuId);
    },

    async adjust(userId, skuId, { type, quantity, note }) {
      const before = await skus.get(userId, skuId);
      let { currentStock, inbound, unfulfillable } = before;
      if (type === 'receive') {
        currentStock += quantity;
        inbound = Math.max(0, inbound - quantity);
      } else if (type === 'damaged') {
        if (quantity > currentStock) throw unprocessable('INSUFFICIENT_STOCK', `Only ${currentStock} sellable units are on record`);
        currentStock -= quantity;
        unfulfillable += quantity;
      } else {
        currentStock = quantity; // cycle count: the physical count wins
      }
      const at = new Date(clock()).toISOString();
      await repo.updateSku(userId, skuId, { currentStock, inbound, unfulfillable, updatedAt: at });
      const after = await skus.get(userId, skuId);
      const delta = after.currentStock - before.currentStock;
      const entry = {
        adjustmentId: newId('adj'), userId, skuId, sku: before.sku, name: before.name, type, quantity, note: note || '', at,
        before: snap(before), after: snap(after), delta,
        varianceValue: type === 'count' ? round2(delta * before.unitCost) : 0,
        riskBefore: before.metrics.classification, riskAfter: after.metrics.classification,
      };
      await repo.addAdjustment(entry);
      await audit.record(userId, `stock.${type}`, 'sku', skuId, `${type} of ${quantity} units on ${before.sku}`);
      return { adjustment: entry, sku: after };
    },

    history: (userId, { limit }) => repo.listAdjustments(userId, { limit }),
  };
}