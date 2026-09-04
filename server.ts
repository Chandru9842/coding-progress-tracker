import express from 'express';
import path from 'path';
import fs from 'fs';
import app from './server/src/app.js';
import { seedInitialAdmin } from './server/src/services/userService.js';
import { startMidnightCronScheduler } from './server/src/services/cronService.js';

const PORT = 3000;
const HOST = '0.0.0.0';

function mountStatic(expressApp: express.Application) {
  const distPath = path.resolve(process.cwd(), 'client/dist');
  
  // Fast caching for hashed assets
  expressApp.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // Static root files (favicon, etc.)
  expressApp.use(express.static(distPath, {
    maxAge: '1h',
    etag: true,
  }));

  // SPA fallback for all non-API routes
  expressApp.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function startServer() {
  console.log('[Server] Booting Coding Progress Tracker...');
  
  try {
    await seedInitialAdmin();
  } catch (seedErr) {
    console.warn('[Server] Initial seed notice:', seedErr);
  }

  const distIndexHtml = path.resolve(process.cwd(), 'client/dist/index.html');
  const distExists = fs.existsSync(distIndexHtml);

  if (distExists) {
    console.log('[Server] Serving pre-compiled high-performance frontend bundle from client/dist');
    mountStatic(app);
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        root: path.resolve(process.cwd(), 'client'),
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Server] Vite dev middleware attached.');
    } catch (viteErr) {
      console.warn('[Server] Falling back to static assets:', viteErr);
      mountStatic(app);
    }
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Server] Application running at http://${HOST}:${PORT}`);
    console.log(`[Server] API endpoint at http://${HOST}:${PORT}/api/v1`);

    if (process.env.NODE_ENV !== 'test') {
      startMidnightCronScheduler();
    }
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
