import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';
import { syncGoogleSheetLink } from './googleSheetsService.js';

let cronTimer: NodeJS.Timeout | null = null;
let intervalTimer: NodeJS.Timeout | null = null;
let lastSyncedISTDate: string | null = null;
let isReconciliationRunning = false;

/**
 * Calculates current IST Date and returns YYYY-MM-DD string
 */
export function getISTDateString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  return formatter.format(now); // Produces YYYY-MM-DD in IST reliably
}

/**
 * Checks if today's snapshot has already been recorded in the database.
 * If not, and no reconciliation is currently in flight, triggers a non-blocking background catch-up sync.
 * This guarantees automatic daily updates even on serverless platforms (Vercel) without relying exclusively on cron daemons.
 */
export async function checkAndTriggerLazyCatchUpSync(): Promise<void> {
  const currentIST = getISTDateString();

  if (lastSyncedISTDate === currentIST || isReconciliationRunning) {
    return;
  }

  try {
    let hasTodaySnapshot = false;
    const todayDateObj = new Date(`${currentIST}T00:00:00.000Z`);

    if (!process.env.DATABASE_URL) {
      hasTodaySnapshot = inMemoryStore.snapshots.some(
        (s) => new Date(s.snapshot_date).toISOString().split('T')[0] === currentIST
      );
    } else {
      const snapCount = await prisma.dailyCodingSnapshot.count({
        where: { snapshot_date: todayDateObj },
      });
      hasTodaySnapshot = snapCount > 0;
    }

    if (hasTodaySnapshot) {
      lastSyncedISTDate = currentIST;
      return;
    }

    console.log(`[AutoCatchUp] Missing daily coding snapshot for ${currentIST}. Launching automated background catch-up reconciliation...`);
    // Fire and forget non-blocking background task
    executeFullDailyReconciliation().catch((err) => {
      console.error('[AutoCatchUp] Background catch-up sync encountered error:', err?.message || err);
    });
  } catch (err: any) {
    console.warn('[AutoCatchUp] Check skipped due to error:', err?.message || err);
  }
}

/**
 * Syncs all active Google Sheets with the latest snapshot data.
 */
export async function runMidnightAutoSync(): Promise<void> {
  console.log('[CRON] Starting Google Sheets Auto-Sync for active sheets...');

  try {
    let activeLinks: { id: string; owner_user_id: string }[] = [];

    if (!process.env.DATABASE_URL) {
      activeLinks = inMemoryStore.googleSheetLinks
        .filter((lnk) => lnk.is_active)
        .map((lnk) => ({ id: lnk.id, owner_user_id: lnk.owner_user_id }));
    } else {
      activeLinks = await prisma.googleSheetLink.findMany({
        where: { is_active: true },
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
    console.error('[CRON] Failed to execute Google Sheets auto-sync task:', error?.message || error);
  }
}

/**
 * Executes full reconciliation:
 * 1. Fetches fresh LeetCode stats for all students & creates today's daily snapshot
 * 2. Updates all active Google Sheets with latest date columns
 */
export async function executeFullDailyReconciliation(): Promise<void> {
  if (isReconciliationRunning) {
    console.log('[CRON] Reconciliation already in progress. Skipping duplicate invocation.');
    return;
  }

  isReconciliationRunning = true;
  const istDate = getISTDateString();
  console.log(`[CRON] Executing full daily reconciliation for IST date: ${istDate}...`);

  try {
    const { runDailyMidnightReconciliation } = await import('./leetcodeService.js');
    const result = await runDailyMidnightReconciliation();
    lastSyncedISTDate = istDate;
    console.log(`[CRON] Daily reconciliation completed successfully for ${istDate}:`, result);
  } catch (err: any) {
    console.error(`[CRON] Failed full daily reconciliation for ${istDate}:`, err?.message || err);
    // Fallback: still attempt to sync sheets
    try {
      await runMidnightAutoSync();
    } catch (sheetErr: any) {
      console.error('[CRON] Fallback sheet auto-sync error:', sheetErr?.message || sheetErr);
    }
  } finally {
    isReconciliationRunning = false;
  }
}

export function startMidnightCronScheduler(): void {
  const scheduleNextRun = () => {
    const now = new Date();

    // 12:30 AM IST = 19:00 UTC on the previous calendar day
    // Target hour: 19:00 UTC (which is 00:30 AM IST next morning)
    const targetUTC = new Date(now);
    targetUTC.setUTCHours(19, 0, 0, 0);

    if (targetUTC.getTime() <= now.getTime()) {
      targetUTC.setUTCDate(targetUTC.getUTCDate() + 1);
    }

    const msUntilRun = Math.max(1000, targetUTC.getTime() - now.getTime());
    console.log(`[CRON] 12:30 AM IST Auto-Sync Scheduler active. Next run in ${Math.round(msUntilRun / 1000 / 60)} minutes (at 12:30 AM IST / 19:00 UTC).`);

    cronTimer = setTimeout(async () => {
      await executeFullDailyReconciliation();
      scheduleNextRun();
    }, msUntilRun);
  };

  scheduleNextRun();

  // Safety interval: every 30 minutes, check if today's IST reconciliation hasn't run yet
  if (!intervalTimer) {
    intervalTimer = setInterval(async () => {
      const currentIST = getISTDateString();
      if (lastSyncedISTDate !== currentIST) {
        // Check current IST hour
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        const istHour = istTime.getUTCHours();

        // If it's already past 1:00 AM IST and haven't synced today, run reconciliation
        if (istHour >= 1) {
          console.log(`[CRON] Detected missing daily snapshot for ${currentIST} (current IST hour: ${istHour}). Running catch-up sync...`);
          await executeFullDailyReconciliation();
        }
      }
    }, 30 * 60 * 1000);
  }
}

export function stopMidnightCronScheduler(): void {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
