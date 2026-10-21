import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { makeRuntime, baseSku, NOW } from './helpers.js';

async function setup() {
  const rt = await makeRuntime({ env: { ALLOW_DEMO_USER_SWITCH: 'true' } });
  await rt.repo.putUser({ userId: 'user_view', displayName: 'Viewer', role: 'viewer', createdAt: 'x', lastActiveAt: 'x' });
  const app = await buildApp(rt, { logger: false });
  return { app, rt };
}

describe('REST API', () => {
  it('serves the dashboard and SKU list for the demo admin', async () => {
    const { app } = await setup();
    const dash = await app.inject('/api/v1/dashboard');
    expect(dash.statusCode).toBe(200);
    expect(dash.json().data.totals.totalSkus).toBe(30);
    const list = await app.inject('/api/v1/skus?limit=5&sort=velocity&dir=desc');
    expect(list.json().data.items).toHaveLength(5);
    expect(list.json().meta.total).toBe(30);
    const me = await app.inject('/api/v1/me');
    expect(me.json().data.role).toBe('admin');
  });
  it('creates and deletes a SKU, rejecting bad input', async () => {
    const { app } = await setup();
    const bad = await app.inject({ method: 'POST', url: '/api/v1/skus', payload: { sku: 'x' } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/api/v1/skus', payload: baseSku({ sku: 'NEW-1' }) });
    expect(ok.statusCode).toBe(201);
    const dup = await app.inject({ method: 'POST', url: '/api/v1/skus', payload: baseSku({ sku: 'NEW-1' }) });
    expect(dup.statusCode).toBe(409);
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/skus/${ok.json().data.skuId}` });
    expect(del.statusCode).toBe(200);
  });
  it('enforces roles: viewers can read and export but not write', async () => {
    const { app } = await setup();
    const h = { 'x-demo-user': 'user_view' };
    expect((await app.inject({ url: '/api/v1/skus', headers: h })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/skus', headers: h, payload: baseSku() })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/skus/import', headers: h, payload: { rows: [baseSku()] } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/demo/load', headers: h })).statusCode).toBe(403);
    const csv = await app.inject({ url: '/api/v1/skus/export', headers: h });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
  });
  it('treats a SQL-injection-looking search as plain text', async () => {
    const { app } = await setup();
    const r = await app.inject({ url: `/api/v1/skus?q=${encodeURIComponent("' OR 1=1; DROP TABLE skus;--")}` });
    expect(r.statusCode).toBe(200);
    expect(r.json().meta.total).toBe(0);
  });
  it('loads demo data only into an empty catalog', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'POST', url: '/api/v1/demo/load' })).statusCode).toBe(409);
  });
});
