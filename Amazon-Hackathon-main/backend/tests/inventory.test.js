import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../src/domain/inventory.js';
import { NOW, baseSku, flatSales } from './helpers.js';

const m = (sku, perDay) => computeMetrics(baseSku(sku), flatSales(perDay), NOW);

describe('risk engine', () => {
  it('computes velocity, cover and reorder point', () => {
    const r = m({ currentStock: 200, leadTimeDays: 20, safetyStock: 10 }, 10);
    expect(r.velocity).toBe(10);
    expect(r.daysOfCover).toBe(20);
    expect(r.reorderPointRecommended).toBe(210); // 10 x 20 + 10
  });
  it('flags critical stockout and recommends a reorder quantity', () => {
    const r = m({ currentStock: 40, leadTimeDays: 20 }, 10);
    expect(r.classification).toBe('critical');
    expect(r.stockoutRisk).toBe('high');
    expect(r.recommendedReorderQty).toBe(10 * (20 + 45) + 10 - 40);
    expect(r.recommendedReorderDate).toBe('2026-10-13');
    expect(r.explanation).toMatch(/Reorder about/);
  });
  it('treats out-of-stock with demand as critical even when inbound exists', () => {
    expect(m({ currentStock: 0, inbound: 5000 }, 10).classification).toBe('critical');
  });
  it('flags low stock when position is at or below the reorder point', () => {
    expect(m({ currentStock: 150, leadTimeDays: 20, safetyStock: 10 }, 10).classification).toBe('low_stock');
  });
  it('flags overstock, slow moving, stranded and healthy', () => {
    expect(m({ currentStock: 2000 }, 10).classification).toBe('overstock');
    expect(m({ currentStock: 80 }, 0.1).classification).toBe('slow_moving');
    expect(m({ status: 'stranded', currentStock: 50 }, 5).classification).toBe('stranded');
    expect(m({ currentStock: 600 }, 10).classification).toBe('healthy');
  });
  it('does not recommend reordering inactive SKUs and handles zero sales', () => {
    expect(m({ status: 'inactive', currentStock: 0 }, 10).recommendedReorderQty).toBe(0);
    const none = m({ currentStock: 0 }, 0);
    expect(none.daysOfCover).toBeNull();
    expect(none.stockoutDate).toBeNull();
  });
  it('keeps health score within 0..100', () => {
    for (const stock of [0, 10, 100, 600, 5000]) {
      const h = m({ currentStock: stock, unfulfillable: 500 }, 10).healthScore;
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(100);
    }
  });
});
