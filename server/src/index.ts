import app from './app.js';
import { env } from './config/env.js';
import { seedInitialAdmin } from './services/userService.js';
import { runPeriodicAutoSync } from './services/leetcodeService.js';
import { startMidnightCronScheduler } from './services/cronService.js';

const PORT = parseInt(env.PORT, 10) || 5000;

app.listen(PORT, async () => {
  console.log(`[Server] Coding Progress Tracker API running on http://localhost:${PORT}`);
  console.log(`[Server] API Base Endpoint: http://localhost:${PORT}/api/v1`);
  await seedInitialAdmin();

  // Local Background Scheduler Adapter (15-min near-real-time periodic polling)
  if (process.env.NODE_ENV !== 'test') {
    console.log('[Auto-Sync Scheduler] Initialized background polling adapter (15m near-real-time + 12:30 AM IST reconciliation).');
    
    // Trigger initial background sync safely
    runPeriodicAutoSync().catch((err) => console.warn('[Auto-Sync Startup Warning]:', err));

    // Initialize 12:30 AM Midnight Auto-Sync Cron for Google Sheets
    startMidnightCronScheduler();

    // Set 15-minute polling interval
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    setInterval(() => {
      runPeriodicAutoSync().catch((err) => console.warn('[Auto-Sync Interval Warning]:', err));
    }, FIFTEEN_MINUTES_MS);
  }
});
