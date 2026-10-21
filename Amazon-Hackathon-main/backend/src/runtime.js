import { loadConfig } from './config/index.js';
import { createMemoryRepository } from './repositories/memory.js';
import { createAiProvider } from './services/ai/index.js';
import { createServices } from './services/index.js';
import { seedDemo } from './seed/demo.js';
import { systemClock } from './utils/time.js';

/** Config + repository + AI provider + services, shared by the REST server and tests. */
export async function createRuntime(env = process.env, { clock = systemClock, config: provided, repo: providedRepo } = {}) {
  const config = provided ?? loadConfig(env);
  const repo = providedRepo ?? createMemoryRepository();
  if (!providedRepo && config.seedOnStart) await seedDemo(repo, clock(), config.demoUserId);
  const ai = createAiProvider(config.ai);
  const services = createServices({ repo, config, ai, clock });
  return { config, repo, ai, services, clock };
}
