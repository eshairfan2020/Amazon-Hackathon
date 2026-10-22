import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { makeRuntime, ESHA } from './helpers.js';
import * as S from '../src/domain/schemas.js';

const first = async (services, risk) => (await services.skus.list(ESHA, S.skuListQuery.parse({ risk, limit: 1 }))).items[0];

describe('barcode lookup', () => {
  it('finds a SKU by barcode, UPC-A form, SKU code and ASIN, and 404s otherwise', async () => {
    const { services } = await makeRuntime();
    const s = await first(services, 'critical');
    expect(s.barcode).toMatch(/^\d{13}$/);
    for (const code of [s.barcode, s.sku.toLowerCase(), s.asin]) {
      expect((await services.scan.lookup(ESHA, code)).skuId).toBe(s.skuId);
    }
    await expect(services.scan.lookup(ESHA, '0000000000000')).rejects.toMatchObject({ status: 404 });
  });
  it('treats UPC-A and EAN-13 with a leading zero as the same product', async () => {
    const { services } = await makeRuntime({ seed: false });
    const base = { sku: 'UPC-1', asin: 'B0UPC00001', name: 'UPC item', category: 'Home', supplier: 'Acme', unitCost: 2, price: 9, currentStock: 10, warehouse: 'FBA-ONT8', leadTimeDays: 10 };
    const made = await services.skus.create('u1', S.skuCreate.parse({ ...base, barcode: '012345678905' }));
    expect((await services.scan.lookup('u1', '0012345678905')).skuId).toBe(made.skuId);
    expect((await services.scan.lookup('u1', '012345678905')).skuId).toBe(made.skuId);
  });
  it('does not leak other users SKUs', async () => {
    const { services } = await makeRuntime();
    const s = await first(services, 'critical');
    await expect(services.scan.lookup('someone_else', s.barcode)).rejects.toMatchObject({ status: 404 });
  });
});

describe('stock adjustments', () => {
  it('receiving stock lowers inbound, raises stock and can clear a critical risk', async () => {
    const { services } = await makeRuntime();
    const s = await first(services, 'critical');
    const r = await services.scan.adjust(ESHA, s.skuId, { type: 'receive', quantity: 5000 });
    expect(r.sku.currentStock).toBe(s.currentStock + 5000);
    expect(r.adjustment.riskBefore).toBe('critical');
    expect(r.adjustment.riskAfter).not.toBe('critical');
  });
  it('cycle count corrects stock and records variance value', async () => {
    const { services } = await makeRuntime();
    const s = await first(services, 'healthy');
    const r = await services.scan.adjust(ESHA, s.skuId, { type: 'count', quantity: s.currentStock - 10 });
    expect(r.adjustment.delta).toBe(-10);
    expect(r.adjustment.varianceValue).toBe(-10 * s.unitCost);
  });
  it('damaged moves units to unfulfillable and cannot exceed stock', async () => {
    const { services } = await makeRuntime();
    const s = await first(services, 'healthy');
    const r = await services.scan.adjust(ESHA, s.skuId, { type: 'damaged', quantity: 3 });
    expect(r.sku.unfulfillable).toBe(s.unfulfillable + 3);
    await expect(services.scan.adjust(ESHA, s.skuId, { type: 'damaged', quantity: 10_000_000 })).rejects.toMatchObject({ status: 422 });
    expect((await services.scan.history(ESHA, { limit: 10 })).length).toBe(1);
  });
  it('validates input and enforces roles over HTTP', async () => {
    expect(S.adjustBody.safeParse({ type: 'receive', quantity: 0 }).success).toBe(false);
    expect(S.adjustBody.safeParse({ type: 'count', quantity: 0 }).success).toBe(true);
    expect(S.adjustBody.safeParse({ type: 'steal', quantity: 1 }).success).toBe(false);
    const rt = await makeRuntime({ env: { ALLOW_DEMO_USER_SWITCH: 'true' } });
    await rt.repo.putUser({ userId: 'user_view', displayName: 'V', role: 'viewer', createdAt: 'x', lastActiveAt: 'x' });
    const app = await buildApp(rt, { logger: false });
    const s = await first(rt.services, 'healthy');
    const h = { 'x-demo-user': 'user_view' };
    // viewers have their own (empty) catalog, so the admin's barcode must not resolve for them
    expect((await app.inject({ url: `/api/v1/scan/lookup?code=${s.barcode}`, headers: h })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/v1/scan/lookup?code=${s.barcode}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/api/v1/skus/${s.skuId}/adjust`, headers: h, payload: { type: 'receive', quantity: 5 } })).statusCode).toBe(403);
    const ok = await app.inject({ method: 'POST', url: `/api/v1/skus/${s.skuId}/adjust`, payload: { type: 'receive', quantity: 5 } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject('/api/v1/adjustments')).json().data).toHaveLength(1);
  });
});