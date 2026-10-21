import { createAuditService } from './audit.js';
import { createUserService } from './users.js';
import { createSkuService } from './skus.js';
import { createDashboardService } from './dashboard.js';
import { createDemoService } from './demo.js';

/** Composition root. Routes call these services; they hold all business rules. */
export function createServices({ repo, config, clock }) {
  const audit = createAuditService({ repo, clock });
  const users = createUserService({ repo, clock, config });
  const skus = createSkuService({ repo, config, clock, audit });
  const dashboard = createDashboardService({ skus, clock });
  const demo = createDemoService({ repo, clock, audit });
  return { audit, users, skus, dashboard, demo };
}
