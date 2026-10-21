
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { newId } from './utils/ids.js';
import { AppError, notFound, unauthorized } from './utils/errors.js';
import { lookupToken } from './config/index.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(runtime, { logger } = {}) {
  const { config, services } = runtime;

  const app = Fastify({
    logger: logger ?? {
      level: config.logLevel,
      redact: [
        'req.headers.authorization',
        'req.headers["x-admin-token"]',
        'req.headers["idempotency-key"]',
      ],
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => newId('req'),
    bodyLimit: 64 * 1024,
    trustProxy: false,
  });

  await app.register(cors, {
    origin: config.corsOrigins.length ? config.corsOrigins : false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'idempotency-key',
      'x-request-id',
      'x-demo-user',
      'x-admin-token',
    ],
    exposedHeaders: ['x-request-id'],
  });

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: '1 minute',
  });

  app.decorateRequest('auth', null);

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
    reply.header('cache-control', 'no-store');
  });

  app.addHook('onRequest', async (req) => {
    if (req.routeOptions?.config?.public) return;
    if (req.method === 'OPTIONS') return;

    const match = /^Bearer\s+(.+)$/i.exec(
      req.headers.authorization || ''
    );
    const token = match?.[1];

    let userId;
    let profile = {};

    if (config.authMode === 'supabase') {
      if (!token) {
        throw unauthorized('Missing Supabase access token');
      }

      let response;

      try {
        response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
          method: 'GET',
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        const error = new AppError(
          'AUTH_SERVICE_UNAVAILABLE',
          'Authentication service is temporarily unavailable',
          503
        );
        throw error;
      }

      if (response.status === 401 || response.status === 403) {
        throw unauthorized('Invalid or expired Supabase access token');
      }

      if (!response.ok) {
        req.log.error(
          { status: response.status },
          'Supabase authentication verification failed'
        );

        throw new AppError(
          'AUTH_SERVICE_UNAVAILABLE',
          'Authentication service is temporarily unavailable',
          503
        );
      }

      let verifiedUser;

      try {
        verifiedUser = await response.json();
      } catch {
        throw unauthorized('Invalid Supabase user response');
      }

      if (
        typeof verifiedUser.id !== 'string' ||
        verifiedUser.id.length === 0
      ) {
        throw unauthorized('Supabase did not return a valid user');
      }

      userId = verifiedUser.id;

      const metadata =
        verifiedUser.user_metadata &&
        typeof verifiedUser.user_metadata === 'object'
          ? verifiedUser.user_metadata
          : {};

      profile = {
        displayName:
          metadata.full_name ||
          metadata.name ||
          metadata.display_name ||
          verifiedUser.email?.split('@')[0] ||
          'User',
        email: verifiedUser.email,
      };

      await services.users.ensure(userId, profile);
    } else if (config.authMode === 'bearer') {
      userId = lookupToken(config, token);

      if (!userId) {
        throw unauthorized('Missing or invalid bearer token');
      }

      await services.users.ensure(userId);
    } else {
      // Demo-only authentication.
      userId = config.demoUserId;

      const requested = req.headers['x-demo-user'];

      if (requested && config.allowDemoUserSwitch) {
        if (!(await runtime.repo.getUser(String(requested)))) {
          throw unauthorized('Unknown demo user');
        }

        userId = String(requested);
      }

      if (!(await runtime.repo.getUser(userId))) {
        throw unauthorized(
          'Demo user does not exist; seed the demo data'
        );
      }
    }

    const user = await services.users.ensure(userId, profile);
    req.auth = { userId, role: user.role ?? 'viewer', mode: config.authMode };

    await services.users.touch(userId).catch(() => {});
  });

  await registerRoutes(app, runtime);

  app.setNotFoundHandler((req, reply) => {
    const error = notFound('Route');

    reply.code(404).send({
      error: {
        code: error.code,
        message: `Route ${req.method} ${req.url.split('?')[0]} not found`,
        requestId: req.id,
      },
    });
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      if (err.status === 401) {
        reply.header('www-authenticate', 'Bearer');
      }

      return reply.code(err.status).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
          requestId: req.id,
        },
      });
    }

    if (err.statusCode === 429) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          requestId: req.id,
        },
      });
    }

    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({
        error: {
          code: err.code || 'BAD_REQUEST',
          message: 'Malformed request',
          requestId: req.id,
        },
      });
    }

    req.log.error(
      {
        err: {
          name: err.name,
          code: err.code,
          message: err.message,
        },
        requestId: req.id,
      },
      'unhandled error'
    );

    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: req.id,
      },
    });
  });

  return app;
}
