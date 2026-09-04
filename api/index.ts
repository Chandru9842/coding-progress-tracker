import app from '../server/src/app.js';
import { seedInitialAdmin } from '../server/src/services/userService.js';

// Vercel Serverless Function Execution Timeout (up to 60s for full LeetCode reconciliation)
export const maxDuration = 60;
export const config = {
  maxDuration: 60,
};

// Attempt initial admin seed on serverless invocation (fire and forget / cached)
seedInitialAdmin().catch((err) => {
  console.warn('[Vercel Serverless] Auto-seed warning:', err instanceof Error ? err.message : err);
});

export default app;
