import { createSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createServices } from '../src/services/index.js';
import { createAlexaVerifier, isValidCertUrl, parseChain, timestampOk, validateChain } from '../src/alexa/verify.js';
import { handleAlexaRequest, parseLinks } from '../src/alexa/skill.js';
import { parseCommand, parseQuantity } from '../src/domain/voice.js';
import { makeRuntime, ESHA, NOW } from './helpers.js';
import { LEAF_KEY, LEAF_PEM, ROOT_PEM, WRONG_HOST_PEM } from './fixtures/alexaChain.js';
import * as S from '../src/domain/schemas.js';
import model from '../alexa/interaction-model.en-US.json' with { type: 'json' };

const say = async (voice, user, text, pending = null) => voice.command(user, { text, pending });

describe('voice language', () => {
  it('parses quantities and add commands', () => {
    expect(parseQuantity('twenty five')).toBe(25);
    expect(parseQuantity('one hundred')).toBe(100);
    expect(parseQuantity('banana')).toBeNull();
    expect(parseCommand('Alexa, tell Anchor to add 20 body lotions to my inventory')).toEqual({ intent: 'add', slots: { quantity: 20, product: 'body lotions' } });
    expect(parseCommand('add a body lotion').slots.quantity).toBe(1);
    expect(parseCommand('add body lotion').slots.quantity).toBeNull();
    expect(parseCommand('how many yoga mats do I have?').intent).toBe('stock');
    expect(parseCommand('what is running low').intent).toBe('low');
    expect(parseCommand('what should I reorder today').intent).toBe('reorder');
    expect(parseCommand('yes').intent).toBe('yes');
  });
});

describe('voice service: propose, then confirm', () => {
  it('creates a draft product only after a yes', async () => {
    const { services, repo } = await makeRuntime();
    const before = await repo.countSkus(ESHA);
    const ask = await say(services.voice, ESHA, 'add 20 body lotions to my inventory');
    expect(ask.speech).toMatch(/Create it with 20 units/);
    expect(ask.pending).toMatchObject({ type: 'create', name: 'Body Lotion', quantity: 20 });
    expect(ask.end).toBe(false);
    expect(await repo.countSkus(ESHA)).toBe(before); // nothing changed yet
    const done = await say(services.voice, ESHA, 'yes', ask.pending);
    expect(done.speech).toMatch(/saved as a draft/);
    const created = await repo.findSkuByCode(ESHA, 'VOICE-001');
    expect(created).toMatchObject({ name: 'Body Lotion', currentStock: 20, needsDetails: true, source: 'voice' });
    expect(await repo.countSkus(ESHA)).toBe(before + 1);
  });
  it('declining or a bare yes changes nothing', async () => {
    const { services, repo } = await makeRuntime();
    const before = await repo.countSkus(ESHA);
    const ask = await say(services.voice, ESHA, 'add 20 body lotions');
    expect((await say(services.voice, ESHA, 'no', ask.pending)).speech).toMatch(/cancelled/);
    expect((await say(services.voice, ESHA, 'yes', null)).speech).toMatch(/nothing to confirm/);
    expect(await repo.countSkus(ESHA)).toBe(before);
  });
  it('adds stock to an existing product instead of duplicating it', async () => {
    const { services } = await makeRuntime();
    const yoga = (await services.skus.list(ESHA, S.skuListQuery.parse({ q: 'yoga' }))).items[0];
    const ask = await say(services.voice, ESHA, 'add 10 yoga mats');
    expect(ask.pending).toMatchObject({ type: 'receive', skuId: yoga.skuId });
    const done = await say(services.voice, ESHA, 'yes', ask.pending);
    expect(done.speech).toContain(`${yoga.currentStock + 10} units`);
    expect((await services.skus.get(ESHA, yoga.skuId)).currentStock).toBe(yoga.currentStock + 10);
  });
  it('asks for a missing quantity, validates it, and handles ambiguous names', async () => {
    const { services } = await makeRuntime();
    const q = await say(services.voice, ESHA, 'add body lotion');
    expect(q.pending).toMatchObject({ type: 'ask_quantity' });
    const next = await say(services.voice, ESHA, 'twelve', q.pending);
    expect(next.pending).toMatchObject({ type: 'create', quantity: 12 });
    expect((await services.voice.run(ESHA, { intent: 'add', slots: { product: 'body lotion', quantity: 0 } })).speech).toMatch(/not valid/);
    expect((await services.voice.run(ESHA, { intent: 'add', slots: { product: 'mat', quantity: 3 } })).speech).toMatch(/Yoga Mat|several/);
  });
  it('answers read questions from real data', async () => {
    const { services } = await makeRuntime();
    expect((await say(services.voice, ESHA, 'how many yoga mats do I have')).speech).toMatch(/You have \d+ units of Yoga Mat 6mm/);
    expect((await say(services.voice, ESHA, 'what is running low')).speech).toMatch(/need attention/);
    expect((await say(services.voice, ESHA, 'what should I reorder')).speech).toMatch(/I would reorder/);
  });
  it('blocks viewers from changing inventory and rejects forged pending actions', async () => {
    const { services, repo } = await makeRuntime();
    await repo.putUser({ userId: 'user_view', displayName: 'V', role: 'viewer', createdAt: 'x', lastActiveAt: 'x' });
    expect((await say(services.voice, 'user_view', 'add 5 body lotions')).speech).toMatch(/cannot change|can read/);
    const forged = await services.voice.run('user_view', { intent: 'yes', pending: { type: 'create', name: 'Evil', quantity: 5 } });
    expect(forged.speech).toMatch(/cannot change/);
    expect(await repo.findSkuByCode('user_view', 'VOICE-001')).toBeNull();
  });
  it('completing a draft in the app clears the needs-details flag', async () => {
    const { services, repo } = await makeRuntime();
    const ask = await say(services.voice, ESHA, 'add 4 hand soaps');
    await say(services.voice, ESHA, 'yes', ask.pending);
    const draft = await repo.findSkuByCode(ESHA, 'VOICE-001');
    await services.skus.update(ESHA, draft.skuId, S.skuPatch.parse({ price: 9.99, unitCost: 3, supplier: 'Acme', asin: 'B0REALASIN' }));
    expect((await repo.getSku(ESHA, draft.skuId)).needsDetails).toBe(false);
  });
});

describe('voice over HTTP', () => {
  it('serves /voice/command and validates the body', async () => {
    const rt = await makeRuntime();
    const app = await buildApp(rt, { logger: false });
    const ok = await app.inject({ method: 'POST', url: '/api/v1/voice/command', payload: { text: 'what is running low' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.speech).toMatch(/attention/);
    expect((await app.inject({ method: 'POST', url: '/api/v1/voice/command', payload: { text: '' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/voice/command', payload: { text: 'yes', pending: { type: 'drop', name: 'x' } } })).statusCode).toBe(400);
  });
});

describe('Alexa skill', () => {
  const links = parseLinks(['amzn1.ask.account.TEST:user_esha']);
  const intent = (name, slots = {}, extra = {}) => ({ session: { user: { userId: 'amzn1.ask.account.TEST' }, ...extra.session }, request: { type: 'IntentRequest', intent: { name, slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { name: k, value: v }])) }, ...extra.request } });

  it('has a valid interaction model that matches the intents we handle', () => {
    const names = model.interactionModel.languageModel.intents.map((i) => i.name);
    for (const n of ['AddItemIntent', 'StockLevelIntent', 'LowStockIntent', 'ReorderIntent', 'AMAZON.YesIntent', 'AMAZON.NoIntent']) expect(names).toContain(n);
    expect(model.interactionModel.languageModel.invocationName).toBe('anchor inventory');
  });
  it('runs the add flow with session-carried confirmation', async () => {
    const { services, repo } = await makeRuntime();
    const first = await handleAlexaRequest(intent('AddItemIntent', { quantity: '20', product: 'body lotion' }, { request: { dialogState: 'COMPLETED' } }), { voice: services.voice, links });
    expect(first.response.outputSpeech.text).toMatch(/Create it with 20 units/);
    expect(first.response.shouldEndSession).toBe(false);
    expect(first.sessionAttributes.pending).toMatchObject({ type: 'create', quantity: 20 });
    expect(await repo.findSkuByCode(ESHA, 'VOICE-001')).toBeNull();
    const yes = await handleAlexaRequest(intent('AMAZON.YesIntent', {}, { session: { attributes: first.sessionAttributes } }), { voice: services.voice, links });
    expect(yes.response.outputSpeech.text).toMatch(/Added 20 Body Lotion/);
    expect(yes.response.shouldEndSession).toBe(true);
    expect((await repo.findSkuByCode(ESHA, 'VOICE-001')).currentStock).toBe(20);
  });
  it('delegates to Alexa dialog while slots are missing, and handles launch/stop/unlinked users', async () => {
    const { services } = await makeRuntime();
    const d = await handleAlexaRequest(intent('AddItemIntent', { product: 'body lotion' }, { request: { dialogState: 'IN_PROGRESS' } }), { voice: services.voice, links });
    expect(d.response.directives[0].type).toBe('Dialog.Delegate');
    expect((await handleAlexaRequest({ request: { type: 'LaunchRequest' } }, { voice: services.voice, links })).response.outputSpeech.text).toMatch(/Welcome to Anchor/);
    expect((await handleAlexaRequest(intent('AMAZON.StopIntent'), { voice: services.voice, links })).response.shouldEndSession).toBe(true);
    const stranger = intent('LowStockIntent');
    stranger.session.user.userId = 'amzn1.ask.account.STRANGER';
    const r = await handleAlexaRequest(stranger, { voice: services.voice, links });
    expect(r.response.outputSpeech.text).toMatch(/do not know your Anchor account/);
    expect(r.response.card.content).toContain('amzn1.ask.account.STRANGER');
    expect((await handleAlexaRequest({ request: { type: 'SessionEndedRequest' } }, { voice: services.voice, links })).response).toEqual({});
  });
});

describe('Alexa request verification', () => {
  const T = Date.now(); // test certificates are valid from when they were generated
  const url = 'https://s3.amazonaws.com/echo.api/echo-api-cert-7.pem';
  const mkBody = (ts = new Date(T).toISOString(), appId = 'amzn1.ask.skill.TEST') => JSON.stringify({ session: { application: { applicationId: appId }, user: { userId: 'u' } }, request: { type: 'LaunchRequest', timestamp: ts } });
  const sign = (raw, key = LEAF_KEY) => createSign('RSA-SHA256').update(raw).sign(key, 'base64');
  const verifier = (o = {}) => createAlexaVerifier({ skillId: 'amzn1.ask.skill.TEST', fetchCert: async () => `${LEAF_PEM}${ROOT_PEM}`, roots: [ROOT_PEM], now: () => T, ...o });
  const run = (v, raw, headers = {}) => v({ headers: { signaturecertchainurl: url, 'signature-256': sign(raw), ...headers }, rawBody: raw, body: JSON.parse(raw) });

  it('accepts a correctly signed request for our skill', async () => {
    await expect(run(verifier(), mkBody())).resolves.toBeUndefined();
  });
  it('rejects tampering, replay, wrong skill, bad cert URL, wrong host cert and untrusted roots', async () => {
    const raw = mkBody();
    const tampered = `${raw} `; // body changed after signing
    await expect(verifier()({ headers: { signaturecertchainurl: url, 'signature-256': sign(raw) }, rawBody: tampered, body: JSON.parse(tampered) })).rejects.toMatchObject({ code: 'ALEXA_VERIFICATION_FAILED' });
    await expect(run(verifier(), mkBody(new Date(T - 10 * 60_000).toISOString()))).rejects.toThrow(/timestamp/);
    await expect(run(verifier(), mkBody(undefined, 'amzn1.ask.skill.OTHER'))).rejects.toThrow(/different skill/);
    await expect(run(verifier(), raw, { signaturecertchainurl: 'https://evil.example.com/echo.api/x.pem' })).rejects.toThrow(/Invalid certificate URL/);
    await expect(run(verifier({ fetchCert: async () => `${WRONG_HOST_PEM}${ROOT_PEM}` }), raw)).rejects.toThrow(/echo-api/);
    await expect(run(verifier({ roots: [WRONG_HOST_PEM] }), raw)).rejects.toThrow(/not trusted/);
    await expect(run(verifier({ now: () => T + 20 * 365 * 86_400_000 }), raw)).rejects.toThrow(/not currently valid|timestamp/);
    await expect(verifier()({ headers: {}, rawBody: raw, body: JSON.parse(raw) })).rejects.toThrow(/Missing Alexa signature/);
  });
  it('helper checks', () => {
    expect(isValidCertUrl(url)).toBe(true);
    expect(isValidCertUrl('http://s3.amazonaws.com/echo.api/a.pem')).toBe(false);
    expect(isValidCertUrl('https://s3.amazonaws.com:8443/echo.api/a.pem')).toBe(false);
    expect(isValidCertUrl('https://s3.amazonaws.com/other/a.pem')).toBe(false);
    expect(timestampOk(new Date(NOW).toISOString(), NOW)).toBe(true);
    expect(() => validateChain(parseChain(LEAF_PEM), { now: T, roots: [] })).toThrow();
  });
  it('the HTTP endpoint verifies, rejects forged calls and answers real ones', async () => {
    const env = { ALEXA_SKILL_ID: 'amzn1.ask.skill.TEST', ALEXA_LINKS: 'amzn1.ask.account.TEST:user_esha' };
    const rt = await makeRuntime({ env });
    const services = createServices({ repo: rt.repo, config: rt.config, clock: rt.clock, alexaVerifier: verifier() });
    const app = await buildApp({ ...rt, services }, { logger: false });
    const raw = JSON.stringify({ session: { application: { applicationId: 'amzn1.ask.skill.TEST' }, user: { userId: 'amzn1.ask.account.TEST' } }, request: { type: 'IntentRequest', timestamp: new Date(T).toISOString(), intent: { name: 'LowStockIntent', slots: {} } } });
    const headers = { 'content-type': 'application/json', signaturecertchainurl: url, 'signature-256': sign(raw) };
    const ok = await app.inject({ method: 'POST', url: '/api/v1/alexa', headers, payload: raw });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().response.outputSpeech.text).toMatch(/attention|running low/);
    const forged = await app.inject({ method: 'POST', url: '/api/v1/alexa', headers: { ...headers, 'signature-256': sign(raw).replace(/^(.{20})./, (m, a) => a + (m.endsWith('B') ? 'C' : 'B')) }, payload: raw });
    expect(forged.statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/alexa', headers: { 'content-type': 'application/json' }, payload: raw })).statusCode).toBe(400);
    const unconfigured = await buildApp(await makeRuntime(), { logger: false });
    expect((await unconfigured.inject({ method: 'POST', url: '/api/v1/alexa', headers: { 'content-type': 'application/json' }, payload: raw })).statusCode).toBe(503);
  });
  it('refuses to start in production with verification switched off', async () => {
    const { loadConfig } = await import('../src/config/index.js');
    expect(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'supabase', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: 'k', ALEXA_VERIFY: 'false' })).toThrow(/ALEXA_VERIFY/);
  });
});