import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { makeRuntime, ESHA } from './helpers.js';
import { breakEvenPrice, priceForMargin, unitEconomics } from '../src/domain/pricing.js';
import { createServices } from '../src/services/index.js';

const ask = async (services, message) => services.assistant.chat(ESHA, { message });

describe('pricing math', () => {
  it('computes fees, profit, margin, break-even and target price', () => {
    const e = unitEconomics({ price: 25, cost: 10, feePct: 15 });
    expect(e).toMatchObject({ fees: 3.75, unitProfit: 11.25, marginPct: 45 });
    expect(breakEvenPrice({ cost: 10, feePct: 15 })).toBe(11.76);
    expect(priceForMargin({ cost: 10, marginPct: 25, feePct: 15 })).toBe(16.67);
    expect(priceForMargin({ cost: 10, marginPct: 90, feePct: 15 })).toBeNull();
  });
});

describe('business partner assistant', () => {
  it('greets and explains what it can do', async () => {
    const { services } = await makeRuntime();
    const r = await ask(services, 'hi');
    expect(r.reply).toMatch(/partner/i);
    expect(r.suggestions.length).toBeGreaterThan(1);
  });
  it('lists what to reorder with quantities and an estimated spend', async () => {
    const { services } = await makeRuntime();
    const r = await ask(services, 'What should I reorder today?');
    expect(r.intent).toBe('reorder');
    expect(r.reply).toMatch(/Order about \*\*\d+ units/);
    expect(r.reply).toMatch(/\$[\d,]+/);
    expect(r.references.length).toBeGreaterThan(0);
  });
  it('finds overstock and the cash tied up', async () => {
    const { services } = await makeRuntime();
    const r = await ask(services, 'which products have excess inventory?');
    expect(r.intent).toBe('overstock');
    expect(r.reply).toMatch(/tie up|sitting on shelves/);
  });
  it('answers quantity questions by product name or SKU code', async () => {
    const { services } = await makeRuntime();
    const byName = await ask(services, 'how many yoga mat do I have?');
    expect(byName.intent).toBe('product');
    expect(byName.reply).toMatch(/Yoga Mat 6mm/);
    const sku = byName.references[0].sku;
    expect((await ask(services, `units of ${sku} left`)).references[0].sku).toBe(sku);
  });
  it('prices a known product with a strategy card and respects a fee override', async () => {
    const { services } = await makeRuntime();
    const r = await ask(services, 'how should I price the yoga mat? fees are 20%');
    expect(r.intent).toBe('pricing');
    expect(r.card.type).toBe('pricing');
    expect(r.card.feePct).toBe(20);
    expect(r.reply).not.toMatch(/I assumed/);
    const d = await ask(services, 'how should I price the yoga mat?');
    expect(d.reply).toMatch(/I assumed a 15% Amazon fee/);
  });
  it('does maths from numbers the user types', async () => {
    const { services } = await makeRuntime();
    const r = await ask(services, 'my cost is 10 and I sell at 25, what is my profit?');
    expect(r.card.options[0]).toMatchObject({ price: 25, cost: 10, unitProfit: 11.25, marginPct: 45 });
    const warn = await ask(services, 'cost 20 sell at 18');
    expect(warn.reply).toMatch(/lose money/);
  });
  it('shows lowest margins and total potential profit', async () => {
    const { services } = await makeRuntime();
    expect((await ask(services, 'which products have the lowest margin?')).intent).toBe('margins');
    expect((await ask(services, 'how much profit is in my stock?')).reply).toMatch(/\$[\d,]+/);
  });
  it('guides new users with an empty catalog and never invents data', async () => {
    const { services } = await makeRuntime({ seed: false });
    expect((await services.assistant.chat('new_user', { message: 'what should I reorder?' })).intent).toBe('empty');
  });
  it('falls back to the built-in analyst when the AI model fails', async () => {
    const rt = await makeRuntime();
    const failing = { mode: 'bedrock', rewrite: async () => { throw new Error('boom'); } };
    const services = createServices({ repo: rt.repo, config: rt.config, clock: rt.clock, ai: failing });
    const r = await ask(services, 'What should I reorder today?');
    expect(r).toMatchObject({ source: 'builtin', fallback: true });
    expect(r.reply).toMatch(/Order about/);
  });
  it('uses the model text when it succeeds', async () => {
    const rt = await makeRuntime();
    const ai = { mode: 'bedrock', rewrite: async ({ draft }) => `Friendly: ${draft.slice(0, 20)}` };
    const services = createServices({ repo: rt.repo, config: rt.config, clock: rt.clock, ai });
    expect(await ask(services, 'What should I reorder today?')).toMatchObject({ source: 'bedrock', fallback: false });
  });
  it('is reachable over HTTP and validates input', async () => {
    const rt = await makeRuntime();
    const app = await buildApp(rt, { logger: false });
    const ok = await app.inject({ method: 'POST', url: '/api/v1/assistant/chat', payload: { message: 'How is my inventory doing?' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.reply).toMatch(/products/);
    expect((await app.inject({ method: 'POST', url: '/api/v1/assistant/chat', payload: { message: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/assistant/chat', payload: { message: 'x', extra: 1 } })).statusCode).toBe(400);
  });
});