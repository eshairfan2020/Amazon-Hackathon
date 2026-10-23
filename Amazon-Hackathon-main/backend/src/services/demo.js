import { conflict } from '../utils/errors.js';
import { seedCatalog } from '../seed/demo.js';

export function createDemoService({ repo, clock, audit }) {
  const inflight = new Map();
  return {
    /** AUTO_DEMO_DATA mode: seed once per user per process; concurrent first requests share one seeding run. */
    ensureLoaded(userId) {
      // Register the promise synchronously so simultaneous first requests share one seeding run.
      if (!inflight.has(userId)) {
        const run = (async () => {
          if ((await repo.countSkus(userId)) === 0) await seedCatalog(repo, userId, clock());
        })().finally(() => inflight.delete(userId));
        inflight.set(userId, run);
      }
      return inflight.get(userId);
    },

    /** Loads the labelled synthetic catalog. Refuses to touch a user who already has SKUs. */
    async load(userId) {
      if ((await repo.countSkus(userId)) > 0) throw conflict('CATALOG_NOT_EMPTY', 'Demo data can only be loaded into an empty catalog');
      const count = await seedCatalog(repo, userId, clock());
      await audit.record(userId, 'demo.load', 'catalog', 'demo', `Loaded ${count} synthetic demo SKUs`);
      return { loaded: count, synthetic: true };
    },
  };
}