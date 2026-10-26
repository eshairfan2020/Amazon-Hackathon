import { createRuntime } from './runtime.js';
import { buildApp } from './app.js';

let runtime;
try {
  runtime = await createRuntime(process.env);
} catch (err) {
  // Fail closed: misconfiguration (e.g. production without real auth) must stop startup.
  console.error(String(err.message || err));
  process.exit(1);
}

const app = await buildApp(runtime);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err: { message: err.message } }, 'error during shutdown');
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

try {
  if (process.env.NODE_ENV !== 'production') {
  await app.listen({ port: runtime.config.port, host: runtime.config.host });
}
  if (runtime.config.authMode === 'demo') app.log.warn('AUTH_MODE=demo: demo-only identity is active. Never use in production.');
} catch (err) {
  app.log.error({ err: { message: err.message } }, 'failed to start');
  process.exit(1);
}
export default app
