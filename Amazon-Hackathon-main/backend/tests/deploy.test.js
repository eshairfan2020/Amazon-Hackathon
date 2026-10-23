import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { makeRuntime } from './helpers.js';

afterEach(() => vi.unstubAllGlobals());

describe('stateless-host demo mode', () => {
  it('seeds a new user once, even when requests arrive concurrently', async () => {
    const { services, repo } = await makeRuntime({ seed: false, env: { AUTO_DEMO_DATA: 'true' } });
    await Promise.all(Array.from({ length: 6 }, () => services.demo.ensureLoaded('fresh_user')));
    expect(await repo.countSkus('fresh_user')).toBe(30);
    await services.demo.ensureLoaded('fresh_user');
    expect(await repo.countSkus('fresh_user')).toBe(30);
  });
  it('produces identical ids on every instance so records resolve after a cold start', async () => {
    const a = await makeRuntime();
    const b = await makeRuntime();
    const ids = async (rt) => ({ skus: (await rt.repo.listSkus('user_esha')).map((s) => s.skuId), order: (await rt.repo.listOrders('user_esha')).map((o) => o.orderId).sort()[0] });
    expect(await ids(a)).toEqual(await ids(b));
  });
  it('rejects requests without a valid bearer token in bearer mode (the Vercel default)', async () => {
    const rt = await makeRuntime({ seed: false, env: { AUTH_MODE: 'bearer', AUTH_TOKENS: 'tok_1234567890abcdef:user_new', AUTO_DEMO_DATA: 'true' } });
    const app = await buildApp(rt, { logger: false });
    const none = await app.inject('/api/v1/skus');
    expect(none.statusCode).toBe(401);
    expect(none.json().error.message).toBe('Missing or invalid bearer token');
    expect((await app.inject('/health')).statusCode).toBe(200);
    const ok = await app.inject({ url: '/api/v1/skus?limit=1', headers: { authorization: 'Bearer tok_1234567890abcdef' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().meta.total).toBe(30);
  });
  it('verifies Supabase tokens, applies ADMIN_EMAILS and auto-loads demo data', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://proj.supabase.co/auth/v1/user');
      expect(init.headers.apikey).toBe('anon-key');
      return init.headers.Authorization === 'Bearer good'
        ? { ok: true, status: 200, json: async () => ({ id: 'sb_user_1', email: 'Boss@Example.com', user_metadata: { full_name: 'The Boss' } }) }
        : { ok: false, status: 401, json: async () => ({}) };
    }));
    const rt = await makeRuntime({ seed: false, env: { AUTH_MODE: 'supabase', SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_ANON_KEY: 'anon-key', ADMIN_EMAILS: 'boss@example.com', AUTO_DEMO_DATA: 'true', TRUST_PROXY: 'true' } });
    expect(rt.config.trustProxy).toBe(true);
    const app = await buildApp(rt, { logger: false });
    expect((await app.inject({ url: '/api/v1/me', headers: { authorization: 'Bearer bad' } })).statusCode).toBe(401);
    const me = await app.inject({ url: '/api/v1/me', headers: { authorization: 'Bearer good' } });
    expect(me.json().data).toMatchObject({ displayName: 'The Boss', role: 'admin' });
    const dash = await app.inject({ url: '/api/v1/dashboard', headers: { authorization: 'Bearer good' } });
    expect(dash.json().data.totals.totalSkus).toBe(30);
  });
});