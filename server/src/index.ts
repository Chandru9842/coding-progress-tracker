import app from './app.js';
import { env } from './config/env.js';
import { seedInitialAdmin } from './services/userService.js';
import { startMidnightCronScheduler } from './services/cronService.js';

const PORT = parseInt(env.PORT, 10) || 5000;

app.listen(PORT, async () => {
  console.log(`[Server] Coding Progress Tracker API running on http://localhost:${PORT}`);
  console.log(`[Server] API Base Endpoint: http://localhost:${PORT}/api/v1`);
  await seedInitialAdmin();

  // Initialize 12:30 AM Midnight Auto-Sync Cron for Google Sheets
  if (process.env.NODE_ENV !== 'test') {
    startMidnightCronScheduler();
  }
});
