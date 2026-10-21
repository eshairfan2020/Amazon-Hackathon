import { buildDashboard } from '../domain/dashboard.js';

export function createDashboardService({ skus, clock }) {
  return {
    async get(userId, filters) {
      const { items, sales } = await skus.enriched(userId);
      const filtered = skus.filter(items, filters);
      return { ...buildDashboard(filtered, sales, clock()), filters: skus.facets(items), generatedAt: new Date(clock()).toISOString() };
    },
  };
}
