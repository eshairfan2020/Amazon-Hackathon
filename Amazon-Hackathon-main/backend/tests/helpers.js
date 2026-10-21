import { loadConfig } from '../src/config/index.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createServices } from '../src/services/index.js';
import { seedDemo, DEMO_USERS } from '../src/seed/demo.js';

/** Tuesday 2026-10-13 08:00 UTC. */
export const NOW = Date.parse('2026-10-13T08:00:00.000Z');
export const ESHA = DEMO_USERS.esha;

export async function makeRuntime({ seed = true, env = {} } = {}) {
  const clock = () => NOW;
  const config = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'demo', ...env });
  const repo = createMemoryRepository();
  const services = createServices({ repo, config, ai: {}, clock });
  if (seed) await seedDemo(repo, NOW, ESHA);
  return { clock, config, repo, services };
}

export const baseSku = (o = {}) => ({
  sku: 'TST-1', asin: 'B0TEST0001', name: 'Test product', category: 'Home', supplier: 'Acme', unitCost: 5, price: 15,
  currentStock: 100, inbound: 0, reserved: 0, unfulfillable: 0, warehouse: 'FBA-ONT8', marketplace: 'US',
  leadTimeDays: 20, safetyStock: 10, reorderPoint: 0, status: 'active', ...o,
});

/** N days of constant sales ending yesterday relative to NOW. */
export function flatSales(perDay, days = 90) {
  const end = Math.floor(NOW / 86_400_000) * 86_400_000;
  return Array.from({ length: days }, (_, i) => ({ date: new Date(end - (days - i) * 86_400_000).toISOString().slice(0, 10), units: perDay }));
}
