import { conflict } from '../utils/errors.js';
import { seedCatalog } from '../seed/demo.js';

export function createDemoService({ repo, clock, audit }) {
  return {
    /** Loads the labelled synthetic catalog. Refuses to touch a user who already has SKUs. */
    async load(userId) {
      if ((await repo.countSkus(userId)) > 0) throw conflict('CATALOG_NOT_EMPTY', 'Demo data can only be loaded into an empty catalog');
      const count = await seedCatalog(repo, userId, clock());
      await audit.record(userId, 'demo.load', 'catalog', 'demo', `Loaded ${count} synthetic demo SKUs`);
      return { loaded: count, synthetic: true };
    },
  };
}
