import { createRuntime } from '../src/runtime.js';
import { buildApp } from '../src/app.js';

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const runtime = await createRuntime(process.env);
      const app = await buildApp(runtime);
      await app.ready();
      return app;
    })();
  }

  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (error) {
    console.error('API initialization failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'API initialization failed' }));
  }
}