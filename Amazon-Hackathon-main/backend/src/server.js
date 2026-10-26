import { createRuntime } from './runtime.js';
import { buildApp } from './app.js';

// Vercel requires this specific handler format
export default async function handler(req, res) {
  try {
    const runtime = await createRuntime(process.env);
    const app = await buildApp(runtime);
    
    // Let Fastify handle the request
    await app.ready();
    app.server.emit('request', req, res);
    
  } catch (err) {
    // Instead of crashing, log the REAL error and send a JSON response
    console.error('STARTUP_ERROR:', err);
    res.status(500).json({
      error: {
        code: 'STARTUP_ERROR',
        message: err.message,
      }
    });
  }
}

// This part is ONLY for local development (npm run dev)
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    try {
      const runtime = await createRuntime(process.env);
      const app = await buildApp(runtime);
      await app.listen({ port: runtime.config.port, host: runtime.config.host });
      console.log(`Local server listening on port ${runtime.config.port}`);
    } catch (err) {
      console.error('Local startup failed:', err);
    }
  })();
}