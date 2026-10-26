import { createRuntime } from './runtime.js';
import { buildApp } from './app.js';

// Vercel will use this exported promise as the handler.
export default async function handler(req, res) {
  try {
    // 1. Initialize the runtime (this is where env vars are read)
    const runtime = await createRuntime(process.env);
    
    // 2. Build the Fastify app
    const app = await buildApp(runtime);
    
    // 3. Let Fastify handle the request
    await app.ready();
    app.server.emit('request', req, res);
    
  } catch (err) {
    // If initialization fails, log the specific error for Vercel's logs
    console.error('FUNCTION_INVOCATION_FAILED: Startup Error:', err);
    
    // Send a clear 500 response instead of crashing the process
    res.status(500).json({
      error: {
        code: 'STARTUP_ERROR',
        message: 'The backend failed to initialize. Check function logs for details.',
        detail: err.message // Expose the error message for debugging
      }
    });
  }
}

// --- This block is for LOCAL development ONLY ---
// Vercel will not execute this block in production.
if (process.env.NODE_ENV !== 'production') {
  const startLocal = async () => {
    try {
      const runtime = await createRuntime(process.env);
      const app = await buildApp(runtime);
      await app.listen({ port: runtime.config.port, host: runtime.config.host });
      console.log(`Server listening on port ${runtime.config.port}`);
    } catch (err) {
      console.error('Local startup failed:', err);
      process.exit(1);
    }
  };
  startLocal();
}