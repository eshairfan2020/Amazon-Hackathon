import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { makeRuntime, baseSku, ESHA, NOW } from './helpers.js';
import * as S from '../src/domain/schemas.js';

const line = (o = {}) => ({ orderNumber: 'IMP-1', placedAt: '2026-10-01', sku: 'IMP-SKU', quantity: 2, ...o });

describe('seeded demo orders', () => {
  it('are consistent with sales, shipments and statuses', async () => {
    const { repo } = await makeRuntime();
    const orders = await repo.listOrders(ESHA);
    expect(orders.length).toBeGreaterThan(1000);
    expect(orders.every((o) => o.demo === true && /^CUST-\d+$/.test(o.customerRef))).toBe(true);
    for (const o of orders) {
      if (o.status === 'pending' || o.status === 'cancelled') expect(o.shipment).toBeNull();
      if (o.status === 'shipped') expect(o.shipment.deliveredAt).toBeNull();
      if (o.status === 'delivered' || o.status === 'returned') expect(Date.parse(o.shipment.deliveredAt)).toBeGreaterThan(Date.parse(o.shipment.shippedAt));
      expect(o.total).toBeGreaterThan(0);
    }
    // units ordered must equal units sold over the same 30 days
    const sales = await repo.listSalesByUser(ESHA);
    const soldLast30 = [...sales.values()].reduce((t, rows) => t + rows.slice(-30).reduce((s, r) => s + r.units, 0), 0);
    expect(orders.reduce((t, o) => t + o.lines.reduce((s, l) => s + l.quantity, 0), 0)).toBe(soldLast30);
  });
});

describe('order service', () => {
  it('summarises received, delivered, in-transit, returned and cancelled', async () => {
    const { services } = await makeRuntime();
    const s = await services.orders.summary(ESHA, 30);
    expect(s.received).toBe(s.pending + s.inTransit + s.delivered + s.returned + s.cancelled);
    expect(s.parcelsDelivered).toBe(s.delivered + s.returned);
    expect(s.avgDeliveryDays).toBeGreaterThan(2);
    expect(s.avgDeliveryDays).toBeLessThan(8);
    expect(s.perDay.length).toBe(31);
    expect(s.demo).toBe(true);
    const week = await services.orders.summary(ESHA, 7);
    expect(week.received).toBeLessThan(s.received);
  });
  it('lists, filters, searches and paginates', async () => {
    const { services } = await makeRuntime();
    const q = (o) => S.orderListQuery.parse(o);
    const delivered = await services.orders.list(ESHA, q({ status: 'delivered', limit: 50 }));
    expect(delivered.items.every((o) => o.status === 'delivered')).toBe(true);
    const sku = delivered.items[0].lines[0].sku;
    const bySku = await services.orders.list(ESHA, q({ sku, limit: 100 }));
    expect(bySku.items.every((o) => o.lines.some((l) => l.sku === sku))).toBe(true);
    const p1 = await services.orders.list(ESHA, q({ limit: 10 }));
    const p2 = await services.orders.list(ESHA, q({ limit: 10, cursor: p1.nextCursor }));
    expect(p1.items[0].orderId).not.toBe(p2.items[0].orderId);
    expect((await services.orders.list(ESHA, q({ q: p1.items[0].orderNumber }))).total).toBe(1);
  });
  it('builds anonymous customer profiles and history', async () => {
    const { services } = await makeRuntime();
    const c = await services.orders.customers(ESHA, { limit: 5 });
    expect(c.repeatRate).toBeGreaterThan(0);
    expect(c.customers[0].spend).toBeGreaterThanOrEqual(c.customers[1].spend);
    const h = await services.orders.customerHistory(ESHA, c.customers[0].customerRef);
    expect(h.profile.orders).toBe(c.customers[0].orders);
    expect(h.orders.length).toBeLessThanOrEqual(50);
    await expect(services.orders.customerHistory(ESHA, 'CUST-0')).rejects.toMatchObject({ status: 404 });
    await expect(services.orders.customerHistory('someone_else', c.customers[0].customerRef)).rejects.toMatchObject({ status: 404 });
  });
});

describe('order import', () => {
  async function withSku() {
    const rt = await makeRuntime({ seed: false });
    await rt.services.skus.create('u1', S.skuCreate.parse(baseSku({ sku: 'IMP-SKU', price: 20 })));
    return rt;
  }
  it('groups lines into orders, derives status, upserts and reports bad rows', async () => {
    const { services } = await withSku();
    const res = await services.orders.importRows('u1', [
      line({ shippedAt: '2026-10-02', deliveredAt: '2026-10-05', customerRef: 'C-1', carrier: 'UPS' }),
      line({ sku: 'imp-sku', quantity: 1 }),
      line({ orderNumber: 'IMP-2', placedAt: '2026-10-03' }),
      line({ orderNumber: 'IMP-3', sku: 'NOPE-1' }),
      line({ orderNumber: 'IMP-4', customerRef: 'jane@example.com' }),
      line({ orderNumber: 'IMP-5', shippedAt: '2026-10-05', deliveredAt: '2026-10-04' }),
      { sku: 'IMP-SKU' },
    ]);
    expect(res).toMatchObject({ created: 2, updated: 0 });
    expect(res.failed.map((f) => f.orderNumber).sort()).toEqual(['IMP-3', 'IMP-4', 'IMP-5', 'row 7']);
    expect(res.failed.find((f) => f.orderNumber === 'IMP-4').errors.join()).toMatch(/anonymous customer ID/);
    const list = await services.orders.list('u1', S.orderListQuery.parse({}));
    const first = list.items.find((o) => o.orderNumber === 'IMP-1');
    expect(first).toMatchObject({ status: 'delivered', total: 60, demo: false });
    expect(list.items.find((o) => o.orderNumber === 'IMP-2').status).toBe('pending');
    const again = await services.orders.importRows('u1', [line({ quantity: 5, shippedAt: '2026-10-02' })]);
    expect(again).toMatchObject({ created: 0, updated: 1 });
  });
  it('does not accept orders for other users SKUs', async () => {
    const { services } = await withSku();
    expect((await services.orders.importRows('u2', [line()])).failed).toHaveLength(1);
  });
});

describe('orders over HTTP and in the AI partner', () => {
  it('serves summary, list and customers, and enforces import roles', async () => {
    const rt = await makeRuntime({ env: { ALLOW_DEMO_USER_SWITCH: 'true' } });
    await rt.repo.putUser({ userId: 'user_view', displayName: 'V', role: 'viewer', createdAt: 'x', lastActiveAt: 'x' });
    const app = await buildApp(rt, { logger: false });
    expect((await app.inject('/api/v1/orders/summary?days=7')).json().data.days).toBe(7);
    expect((await app.inject('/api/v1/orders/summary?days=5')).statusCode).toBe(400);
    const list = await app.inject('/api/v1/orders?status=pending&limit=5');
    expect(list.json().data.length).toBeLessThanOrEqual(5);
    const ref = (await app.inject('/api/v1/customers?limit=1')).json().data.customers[0].customerRef;
    expect((await app.inject(`/api/v1/customers/${ref}`)).statusCode).toBe(200);
    const h = { 'x-demo-user': 'user_view' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/orders/import', headers: h, payload: { rows: [line()] } })).statusCode).toBe(403);
  });
  it('the AI partner answers order, return and customer questions from real numbers', async () => {
    const { services } = await makeRuntime();
    const ask = (message) => services.assistant.chat(ESHA, { message });
    const week = await ask('How many orders were delivered this week?');
    const s7 = await services.orders.summary(ESHA, 7);
    expect(week.intent).toBe('orders');
    expect(week.reply).toContain(`**${s7.received} orders**`);
    expect(week.reply).toContain(`**${s7.parcelsDelivered}** parcels delivered`);
    expect(week.reply).toMatch(/synthetic demo orders/);
    expect((await ask('which products get returned most?')).reply).toMatch(/returned/);
    expect((await ask('who are my best customers?')).reply).toMatch(/CUST-\d+/);
  });
  it('explains there are no orders yet when a user has products but no orders', async () => {
    const { services } = await makeRuntime({ seed: false });
    await services.skus.create('u1', S.skuCreate.parse(baseSku()));
    const r = await services.assistant.chat('u1', { message: 'how many orders did I get?' });
    expect(r.reply).toMatch(/do not see any orders/);
    expect(NOW).toBeGreaterThan(0);
  });
});