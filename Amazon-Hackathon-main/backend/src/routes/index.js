import { validate } from '../utils/validate.js';
import { forbidden } from '../utils/errors.js';
import * as S from '../domain/schemas.js';

/**
 * REST routes. Handlers validate with zod, take the AUTHENTICATED user and role from `req.auth`
 * (never from the body/query) and call the services.
 * Success: { data, meta:{ requestId, nextCursor?, total? } }   Error: { error:{ code, message, details?, requestId } }
 * Roles: viewer = read/export, manager = + create/update/import/demo-load, admin = + delete/audit log.
 */
export async function registerRoutes(app, { services: s, config }) {
  const userId = (req) => req.auth.userId;
  const ok = (req, data, extra = {}) => ({ data, meta: { requestId: req.id, ...extra } });
  const need = (req, ...roles) => {
    if (!roles.includes(req.auth.role)) throw forbidden('FORBIDDEN', 'Your role does not allow this action');
  };

  app.get('/health', { config: { public: true } }, async (req) => ({
    status: 'ok', time: new Date().toISOString(), authMode: config.authMode, repository: config.repository, requestId: req.id,
  }));

  app.get('/api/v1/me', async (req) => {
    const u = await s.users.get(userId(req));
    return ok(req, { userId: u.userId, displayName: u.displayName, email: u.email ?? null, role: u.role });
  });

  app.get('/api/v1/dashboard', async (req) => ok(req, await s.dashboard.get(userId(req), validate(S.filterQuery, req.query))));

  // ---- SKUs (static paths first)
  app.get('/api/v1/skus/export', async (req, reply) => {
    const csv = await s.skus.exportCsv(userId(req), validate(S.filterQuery, req.query));
    reply.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="anchor-skus.csv"');
    return csv;
  });
  app.post('/api/v1/skus/import', { bodyLimit: 1024 * 1024 }, async (req) => {
    need(req, 'admin', 'manager');
    const { rows } = validate(S.importBody, req.body);
    return ok(req, await s.skus.importRows(userId(req), rows));
  });
  app.get('/api/v1/skus', async (req) => {
    const page = await s.skus.list(userId(req), validate(S.skuListQuery, req.query));
    return ok(req, { items: page.items, facets: page.facets }, { nextCursor: page.nextCursor, total: page.total });
  });
  app.post('/api/v1/skus', async (req, reply) => {
    need(req, 'admin', 'manager');
    const body = validate(S.skuCreate, req.body);
    reply.code(201);
    return ok(req, await s.skus.create(userId(req), body));
  });
  app.get('/api/v1/skus/:skuId', async (req) => ok(req, await s.skus.get(userId(req), validate(S.skuParams, req.params).skuId)));
  app.patch('/api/v1/skus/:skuId', async (req) => {
    need(req, 'admin', 'manager');
    const { skuId } = validate(S.skuParams, req.params);
    return ok(req, await s.skus.update(userId(req), skuId, validate(S.skuPatch, req.body)));
  });
  app.delete('/api/v1/skus/:skuId', async (req) => {
    need(req, 'admin');
    return ok(req, await s.skus.remove(userId(req), validate(S.skuParams, req.params).skuId));
  });

  // ---- demo data + audit
  app.post('/api/v1/demo/load', async (req, reply) => {
    need(req, 'admin', 'manager');
    reply.code(201);
    return ok(req, await s.demo.load(userId(req)));
  });
  app.get('/api/v1/audit-logs', async (req) => {
    need(req, 'admin');
    return ok(req, await s.audit.list(userId(req), { limit: 100 }));
  });

  // ---- barcode scan & stock adjustments
  app.get('/api/v1/scan/lookup', async (req) => ok(req, await s.scan.lookup(userId(req), validate(S.scanQuery, req.query).code)));
  app.post('/api/v1/skus/:skuId/adjust', async (req) => {
    need(req, 'admin', 'manager');
    const { skuId } = validate(S.skuParams, req.params);
    return ok(req, await s.scan.adjust(userId(req), skuId, validate(S.adjustBody, req.body)));
  });
  app.get('/api/v1/adjustments', async (req) => ok(req, await s.scan.history(userId(req), validate(S.adjustmentsQuery, req.query))));

  // ---- AI business partner (read-only; stricter rate limit because each call may reach a paid model)
  app.post('/api/v1/assistant/chat', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const body = validate(S.chatBody, req.body);
    return ok(req, await s.assistant.chat(userId(req), body));
  });

  // ---- orders, deliveries, customers (anonymous IDs only)
  app.get('/api/v1/orders/summary', async (req) => ok(req, await s.orders.summary(userId(req), validate(S.summaryQuery, req.query).days)));
  app.post('/api/v1/orders/import', { bodyLimit: 1024 * 1024 }, async (req) => {
    need(req, 'admin', 'manager');
    return ok(req, await s.orders.importRows(userId(req), validate(S.importOrdersBody, req.body).rows));
  });
  app.get('/api/v1/orders', async (req) => {
    const page = await s.orders.list(userId(req), validate(S.orderListQuery, req.query));
    return ok(req, page.items, { total: page.total, nextCursor: page.nextCursor });
  });
  app.get('/api/v1/orders/:orderId', async (req) => ok(req, await s.orders.get(userId(req), validate(S.orderParams, req.params).orderId)));
  app.get('/api/v1/customers', async (req) => ok(req, await s.orders.customers(userId(req), validate(S.customersQuery, req.query))));
  app.get('/api/v1/customers/:customerRef', async (req) => ok(req, await s.orders.customerHistory(userId(req), validate(S.customerParams, req.params).customerRef)));
}