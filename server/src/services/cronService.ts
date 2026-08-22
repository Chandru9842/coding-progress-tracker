import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { syncGoogleSheetLink } from './googleSheetsService.js';

let cronTimer: NodeJS.Timeout | null = null;

export async function runMidnightAutoSync(): Promise<void> {
  console.log('[CRON] Starting 12:00 AM Midnight Google Sheets Auto-Sync...');

  try {
    let activeLinks: { id: string; owner_user_id: string }[] = [];

    if (!process.env.DATABASE_URL) {
      activeLinks = inMemoryStore.googleSheetLinks
        .filter((lnk) => lnk.is_active && lnk.is_auto_sync_enabled)
        .map((lnk) => ({ id: lnk.id, owner_user_id: lnk.owner_user_id }));
    } else {
      activeLinks = await prisma.googleSheetLink.findMany({
        where: { is_active: true, is_auto_sync_enabled: true },
        select: { id: true, owner_user_id: true },
      });
    }

    console.log(`[CRON] Found ${activeLinks.length} active Google Sheet link(s) to auto-sync.`);

    for (const link of activeLinks) {
      try {
        await syncGoogleSheetLink(link.id, { userId: link.owner_user_id, role: 'ADMIN' });
        console.log(`[CRON] Auto-synced Google Sheet link [${link.id}] successfully.`);
      } catch (err: any) {
        console.error(`[CRON] Error auto-syncing Google Sheet link [${link.id}]:`, err?.message || err);
      }
    }
  } catch (error: any) {
    console.error('[CRON] Failed to execute midnight auto-sync task:', error?.message || error);
  }
}

export function startMidnightCronScheduler(): void {
  const scheduleNextRun = () => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0); // 12:00 AM Midnight tonight

    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());
    console.log(`[CRON] Midnight Auto-Sync Scheduler initialized. Next run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at 12:00 AM).`);

    cronTimer = setTimeout(async () => {
      await runMidnightAutoSync();
      scheduleNextRun(); // Reschedule for next midnight
    }, msUntilMidnight);
  };

  scheduleNextRun();
}

export function stopMidnightCronScheduler(): void {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
  }
}
