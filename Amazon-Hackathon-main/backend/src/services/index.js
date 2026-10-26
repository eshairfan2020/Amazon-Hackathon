import { createAuditService } from './audit.js';
import { createUserService } from './users.js';
import { createSkuService } from './skus.js';
import { createDashboardService } from './dashboard.js';
import { createDemoService } from './demo.js';
import { createScanService } from './scan.js';
import { createAssistantService } from './assistant.js';
import { createOrderService } from './orders.js';
import { createVoiceService } from './voice.js';
import { createAlexaVerifier } from '../alexa/verify.js';

/** Composition root. Routes call these services; they hold all business rules. */
export function createServices({ repo, config, clock, ai = { mode: 'fallback' }, alexaVerifier }) {
  const audit = createAuditService({ repo, clock });
  const users = createUserService({ repo, clock, config });
  const skus = createSkuService({ repo, config, clock, audit });
  const dashboard = createDashboardService({ skus, clock });
  const demo = createDemoService({ repo, clock, audit });
  const scan = createScanService({ repo, clock, audit, skus });
  const orders = createOrderService({ repo, clock, audit });
  const assistant = createAssistantService({ skus, ai, orders });
  const voice = createVoiceService({ repo, config, clock, audit, skus, scan, users, demo });
  const verifyAlexa = alexaVerifier ?? createAlexaVerifier({ skillId: config.alexa?.skillId });
  return { audit, users, skus, dashboard, demo, scan, assistant, orders, voice, verifyAlexa };
}