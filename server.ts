import express from 'express';
import path from 'path';
import app from './server/src/app.js';
import { seedInitialAdmin } from './server/src/services/userService.js';
import { runPeriodicAutoSync } from './server/src/services/leetcodeService.js';
import { startMidnightCronScheduler } from './server/src/services/cronService.js';

const PORT = 3000;
const HOST = '0.0.0.0';

function mountStatic(expressApp: express.Application) {
  const distPath = path.resolve(process.cwd(), 'client/dist');
  expressApp.use(express.static(distPath));
  expressApp.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function startServer() {
  console.log('[Server] Booting Coding Progress Tracker...');
  
  // Seed admin user and in-memory sample records if needed
  try {
    await seedInitialAdmin();
  } catch (seedErr) {
    console.warn('[Server] Initial seed warning:', seedErr);
  }

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
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
      console.log('[Server] Vite dev middleware attached successfully.');
    } catch (viteErr) {
      console.warn('[Server] Could not initialize Vite middleware, falling back to static files:', viteErr);
      mountStatic(app);
    }
  } else {
    mountStatic(app);
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Server] Application running at http://${HOST}:${PORT}`);
    console.log(`[Server] API endpoint at http://${HOST}:${PORT}/api/v1`);

    if (process.env.NODE_ENV !== 'test') {
      runPeriodicAutoSync().catch((err) => console.warn('[Auto-Sync Startup Warning]:', err));
      startMidnightCronScheduler();
    }
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
