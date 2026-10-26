import { createHash, timingSafeEqual } from 'node:crypto';
import { mergeInventoryConfig } from '../domain/inventory.js';

const bool = (v, def) =>
  v === undefined || v === ''
    ? def
    : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const int = (v, def) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : def;
};

const list = (v) =>
  v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : [];

export function loadConfig(env = process.env) {
  const errors = [];
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const authMode = env.AUTH_MODE || (isProduction ? 'bearer' : 'demo');

  if (!['demo', 'bearer', 'supabase'].includes(authMode)) {
    errors.push(
      `AUTH_MODE must be "demo", "bearer", or "supabase" (got "${authMode}").`
    );
  }

  if (isProduction && !bool(env.ALEXA_VERIFY, true)) {
    errors.push('ALEXA_VERIFY=false is not allowed in production.');
  }
  if (isProduction && authMode === 'demo') {
    errors.push('AUTH_MODE=demo is not allowed in production; use "supabase" or "bearer".');
  }

  const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || '';

  if (authMode === 'supabase') {
    if (!/^https:\/\/[^/]+$/.test(supabaseUrl)) {
      errors.push('AUTH_MODE=supabase requires SUPABASE_URL to be a valid HTTPS project URL.');
    }
    if (!supabaseAnonKey) {
      errors.push('AUTH_MODE=supabase requires SUPABASE_ANON_KEY.');
    }
  }

  /** SHA-256 token digest -> user ID; raw tokens are never stored. */
  const tokenDigests = new Map();

  for (const pair of list(env.AUTH_TOKENS)) {
    const i = pair.indexOf(':');

    if (i < 1 || i === pair.length - 1) {
      errors.push('AUTH_TOKENS entries must look like "token:userId".');
      continue;
    }

    const token = pair.slice(0, i);

    if (token.length < 16) {
      errors.push('AUTH_TOKENS tokens must be at least 16 characters.');
    }

    tokenDigests.set(sha256(token), pair.slice(i + 1));
  }

  if (authMode === 'bearer' && tokenDigests.size === 0) {
    errors.push('AUTH_MODE=bearer requires AUTH_TOKENS to be set.');
  }

  const repository = 'memory';
  if (env.REPOSITORY && env.REPOSITORY !== 'memory') {
    errors.push('Only REPOSITORY=memory is available in this build (data resets on restart). A Postgres repository comes next; see db/schema.sql.');
  }

  const aiProvider = env.AI_PROVIDER || 'fallback';

  if (!['fallback', 'bedrock'].includes(aiProvider)) {
    errors.push('AI_PROVIDER must be "fallback" or "bedrock".');
  }

  if (aiProvider === 'bedrock' && !env.BEDROCK_MODEL_ID) {
    errors.push('AI_PROVIDER=bedrock requires BEDROCK_MODEL_ID.');
  }

  const devRequested = bool(env.ENABLE_DEV_ENDPOINTS, !isProduction);
  const devAdminToken = env.DEV_ADMIN_TOKEN || '';

  if (isProduction && devRequested && devAdminToken.length < 16) {
    errors.push(
      'In production, ENABLE_DEV_ENDPOINTS=true requires DEV_ADMIN_TOKEN (>=16 chars).'
    );
  }

  let riskOverrides = {};

  if (env.RISK_CONFIG_JSON) {
    try {
      riskOverrides = JSON.parse(env.RISK_CONFIG_JSON);
    } catch {
      errors.push('RISK_CONFIG_JSON is not valid JSON.');
    }
  }

  if (errors.length) {
    throw new Error(`Invalid configuration:\n-${errors.join('\n- ')}`);
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    port: int(env.PORT, 3001),
    host: env.HOST || '127.0.0.1',
    logLevel: env.LOG_LEVEL || 'info',
    authMode,
    supabaseUrl,
    supabaseAnonKey,
    demoUserId: env.DEMO_USER_ID || 'user_esha',
    allowDemoUserSwitch: !isProduction && bool(env.ALLOW_DEMO_USER_SWITCH, true),
    tokenDigests,
    repository,
    seedOnStart: !isProduction && bool(env.SEED_ON_START, true),
    // Demo-only convenience for stateless hosts (e.g. Vercel): give every signed-in user the synthetic demo catalog on first request.
    autoDemoData: bool(env.AUTO_DEMO_DATA, false),
    // Set TRUST_PROXY=true behind Vercel/other proxies so rate limiting sees each client's real IP.
    trustProxy: bool(env.TRUST_PROXY, false),
    dynamo: Object.freeze({
      tableName: env.DYNAMODB_TABLE || 'anchor-ai',
      region: env.AWS_REGION || 'us-east-1',
      endpoint: env.DYNAMODB_ENDPOINT || undefined,
    }),
    ai: Object.freeze({
      provider: aiProvider,
      modelId: env.BEDROCK_MODEL_ID || '',
      region: env.AWS_REGION || 'us-east-1',
      timeoutMs: int(env.BEDROCK_TIMEOUT_MS, 8000),
    }),
    corsOrigins: list(env.CORS_ORIGINS),
    rateLimitMax: int(env.RATE_LIMIT_MAX, 120),
    devEndpoints: devRequested,
    devAdminToken,
    inventory: mergeInventoryConfig(riskOverrides),
    adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
    // Alexa custom skill. ALEXA_LINKS maps Alexa user ids to Anchor user ids: "amzn1.ask.account.X:anchor-user-id,..."
    alexa: { skillId: env.ALEXA_SKILL_ID || '', verify: bool(env.ALEXA_VERIFY, true), links: list(env.ALEXA_LINKS) },
  });
}

export function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

export function lookupToken(config, token) {
  if (!token) return null;

  const digest = Buffer.from(sha256(token), 'hex');
  let found = null;

  for (const [hex, userId] of config.tokenDigests) {
    if (timingSafeEqual(digest, Buffer.from(hex, 'hex'))) {
      found = userId;
    }
  }

  return found;
}

export function safeEqual(a, b) {
  const x = Buffer.from(sha256(String(a)), 'hex');
  const y = Buffer.from(sha256(String(b)), 'hex');
  return timingSafeEqual(x, y);
}