import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { syncGoogleSheetLink } from './googleSheetsService.js';

let cronTimer: NodeJS.Timeout | null = null;

export async function runMidnightAutoSync(): Promise<void> {
  console.log('[CRON] Starting 2:35 AM IST Google Sheets Auto-Sync...');

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
    console.error('[CRON] Failed to execute 2:35 AM IST auto-sync task:', error?.message || error);
  }
}

export function startMidnightCronScheduler(): void {
  const scheduleNextRun = () => {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(2, 35, 0, 0); // 2:35 AM IST tonight/today

    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setDate(nextRun.getDate() + 1); // Tomorrow 2:35 AM IST
    }

    const msUntilRun = Math.max(1000, nextRun.getTime() - now.getTime());
    console.log(`[CRON] 2:35 AM IST Auto-Sync Scheduler initialized. Next run in ${Math.round(msUntilRun / 1000 / 60)} minutes (at 2:35 AM IST).`);

    cronTimer = setTimeout(async () => {
      await runMidnightAutoSync();
      scheduleNextRun(); // Reschedule for next 2:35 AM IST
    }, msUntilRun);
  };

  scheduleNextRun();
}







export function stopMidnightCronScheduler(): void {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
  }
}
