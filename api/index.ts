import app from '../server/src/app.js';
import { seedInitialAdmin } from '../server/src/services/userService.js';

// Attempt initial admin seed on serverless invocation (fire and forget / cached)
seedInitialAdmin().catch((err) => {
  console.warn('[Vercel Serverless] Auto-seed warning:', err instanceof Error ? err.message : err);
});

export default app;
