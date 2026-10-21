import { describe, expect, it } from 'vitest';
import { makeRuntime, baseSku, ESHA } from './helpers.js';
import { csvCell } from '../src/services/skus.js';
import * as S from '../src/domain/schemas.js';

describe('seed data', () => {
  it('has 30 SKUs, 90 days of sales and all six risk classes', async () => {
    const { services, repo } = await makeRuntime();
    const page = await services.skus.list(ESHA, S.skuListQuery.parse({ limit: 100 }));
    expect(page.total).toBe(30);
    const classes = new Set(page.items.map((i) => i.metrics.classification));
    expect([...classes].sort()).toEqual(['critical', 'healthy', 'low_stock', 'overstock', 'slow_moving', 'stranded']);
    const sales = await repo.listSalesByUser(ESHA);
    expect([...sales.values()].every((r) => r.length === 90)).toBe(true);
    expect(new Set(page.items.map((i) => i.category)).size).toBe(5);
  });
});

describe('sku service', () => {
  it('creates, rejects duplicates, updates and deletes', async () => {
    const { services } = await makeRuntime({ seed: false });
    const created = await services.skus.create('u1', S.skuCreate.parse(baseSku({ sku: 'abc-1' })));
    expect(created.sku).toBe('ABC-1');
    await expect(services.skus.create('u1', S.skuCreate.parse(baseSku({ sku: 'ABC-1' })))).rejects.toMatchObject({ code: 'SKU_EXISTS' });
    const upd = await services.skus.update('u1', created.skuId, S.skuPatch.parse({ currentStock: 5 }));
    expect(upd.currentStock).toBe(5);
    await services.skus.remove('u1', created.skuId);
    await expect(services.skus.get('u1', created.skuId)).rejects.toMatchObject({ status: 404 });
  });
  it('isolates users', async () => {
    const { services } = await makeRuntime({ seed: false });
    const a = await services.skus.create('u1', S.skuCreate.parse(baseSku()));
    await expect(services.skus.get('u2', a.skuId)).rejects.toMatchObject({ status: 404 });
    expect((await services.skus.list('u2', S.skuListQuery.parse({}))).total).toBe(0);
  });
  it('searches, filters, sorts and paginates', async () => {
    const { services } = await makeRuntime();
    const q = (o) => S.skuListQuery.parse(o);
    expect((await services.skus.list(ESHA, q({ risk: 'critical' }))).items.every((i) => i.metrics.classification === 'critical')).toBe(true);
    expect((await services.skus.list(ESHA, q({ q: 'yoga' }))).total).toBe(1);
    expect((await services.skus.list(ESHA, q({ category: 'Grocery' }))).total).toBe(5);
    const byCover = await services.skus.list(ESHA, q({ sort: 'daysOfCover', dir: 'asc', limit: 5 }));
    const covers = byCover.items.map((i) => i.metrics.daysOfCover);
    expect(covers).toEqual([...covers].sort((a, b) => a - b));
    const p1 = await services.skus.list(ESHA, q({ limit: 10 }));
    const p2 = await services.skus.list(ESHA, q({ limit: 10, cursor: p1.nextCursor }));
    expect(p1.items[0].skuId).not.toBe(p2.items[0].skuId);
  });
  it('imports with partial success and exports safe CSV', async () => {
    const { services } = await makeRuntime({ seed: false });
    const res = await services.skus.importRows('u1', [
      { ...baseSku({ sku: 'IMP-1', name: '=cmd|calc' }), currentStock: '12' },
      { sku: 'BAD' },
    ]);
    expect(res).toMatchObject({ created: 1, updated: 0 });
    expect(res.failed[0].row).toBe(2);
    const again = await services.skus.importRows('u1', [baseSku({ sku: 'IMP-1', currentStock: 99 })]);
    expect(again.updated).toBe(1);
    const csv = await services.skus.exportCsv('u1', {});
    expect(csv.split('\n')[0]).toContain('unit_cost');
    expect(csv).toContain('IMP-1');
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('a,b')).toBe('"a,b"');
  });
  it('validates input', () => {
    expect(S.skuCreate.safeParse(baseSku({ asin: 'bad' })).success).toBe(false);
    expect(S.skuCreate.safeParse(baseSku({ price: 0 })).success).toBe(false);
    expect(S.skuCreate.safeParse({ ...baseSku(), extra: 1 }).success).toBe(false);
  });
});

describe('dashboard', () => {
  it('summarises the demo catalog', async () => {
    const { services } = await makeRuntime();
    const d = await services.dashboard.get(ESHA, {});
    expect(d.totals.totalSkus).toBe(30);
    expect(d.totals.criticalStock).toBeGreaterThan(0);
    expect(d.totals.healthScore).toBeGreaterThan(0);
    expect(d.charts.salesTrend).toHaveLength(30);
    expect(d.filters.categories).toHaveLength(5);
    const filtered = await services.dashboard.get(ESHA, { category: 'Fitness' });
    expect(filtered.totals.totalSkus).toBe(5);
  });
});
