import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import * as leetcodeService from '../services/leetcodeService.js';
import { diagnosticLogService } from '../services/diagnosticLogService.js';
import { syncErrorService } from '../services/syncErrorService.js';
import { prisma } from '../db/client.js';
import { inMemoryStore } from '../db/inMemoryStore.js';

export async function syncStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;
    const result = await leetcodeService.syncStudentLeetCode(studentId, {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({ message: 'Student LeetCode stats synced successfully', data: result });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to sync LeetCode stats' });
  }
}

export async function syncBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { batchId } = req.params;
    const result = await leetcodeService.syncBatchLeetCode(batchId, {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({ message: 'Batch LeetCode sync completed', data: result });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to sync batch' });
  }
}

export async function syncAllStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    const result = await leetcodeService.runPeriodicAutoSync();
    res.status(200).json({
      message: 'Global LeetCode sync completed',
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute global sync' });
  }
}

export async function syncReportFiltered(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { batchId, sectionId, department, allocationBatchId, staffId } = req.body || {};
    const result = await leetcodeService.syncFilteredStudentsLeetCode(
      { batchId, sectionId, department, allocationBatchId, staffId },
      { userId: req.user.userId, role: req.user.role }
    );

    res.status(200).json({
      message: `Successfully synchronized LeetCode data for ${result.successful} student(s)`,
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to sync filtered students LeetCode data' });
  }
}

export async function getStudentSnapshots(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;
    const snapshots = await leetcodeService.getStudentSnapshots(studentId, {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({ snapshots });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to retrieve student snapshots' });
  }
}

export async function triggerPeriodicAutoSync(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Verify Vercel Cron, Cron Secret, or Admin Role
    const isVercelCron =
      req.headers['x-vercel-cron'] === '1' ||
      (typeof req.headers['user-agent'] === 'string' && req.headers['user-agent'].includes('vercel-cron'));

    const cronSecretHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const querySecret = req.query.secret;
    const expectedSecret = process.env.CRON_SECRET || 'coding_tracker_cron_secret';

    const isCronAuth =
      isVercelCron ||
      !process.env.CRON_SECRET ||
      cronSecretHeader === `Bearer ${expectedSecret}` ||
      cronSecretHeader === expectedSecret ||
      querySecret === expectedSecret;

    if (!isCronAuth && (!req.user || req.user.role !== 'ADMIN')) {
      res.status(403).json({ error: 'Forbidden: Unauthorized cron schedule trigger' });
      return;
    }

    const result = await leetcodeService.runPeriodicAutoSync();
    res.status(200).json({
      message: 'Periodic near-real-time auto-sync completed',
      interval: '15 minutes',
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute periodic auto-sync' });
  }
}

export async function triggerDailyMidnightReconciliation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Verify Vercel Cron, Cron Secret, or Admin Role
    const isVercelCron =
      req.headers['x-vercel-cron'] === '1' ||
      (typeof req.headers['user-agent'] === 'string' && req.headers['user-agent'].includes('vercel-cron'));

    const cronSecretHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const querySecret = req.query.secret;
    const expectedSecret = process.env.CRON_SECRET || 'coding_tracker_cron_secret';

    const isCronAuth =
      isVercelCron ||
      !process.env.CRON_SECRET ||
      cronSecretHeader === `Bearer ${expectedSecret}` ||
      cronSecretHeader === expectedSecret ||
      querySecret === expectedSecret;

    if (!isCronAuth && (!req.user || req.user.role !== 'ADMIN')) {
      res.status(403).json({ error: 'Forbidden: Unauthorized cron schedule trigger' });
      return;
    }

    const result = await leetcodeService.runDailyMidnightReconciliation();
    res.status(200).json({
      message: 'Daily 1:00 PM IST reconciliation sync completed',
      scheduledTimeIST: '1:00 PM IST (07:30 UTC)',
      result,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute daily 1:00 PM IST reconciliation' });
  }
}

export async function getSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const istDate = leetcodeService.getISTDate().toISOString().split('T')[0];

    const { getGoogleSheetsSyncStatus } = await import('../services/googleSheetsService.js');
    const googleSheetsStatus = await getGoogleSheetsSyncStatus({
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({
      status: 'ACTIVE',
      periodicPollingIntervalMinutes: 15,
      dailyReconciliationIST: '12:30 AM IST (Asia/Kolkata)',
      currentISTDate: istDate,
      activeSync: diagnosticLogService.getActiveSyncStatus(),
      googleSheets: googleSheetsStatus,
      vercelCronConfig: {
        cronEndpoint: '/api/v1/cron/daily-sync',
        scheduleUTC: '0 19 * * *',
        hobbyPlanNote: 'Vercel Hobby plan supports once-per-day cron schedules with hour-level precision.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve sync status' });
  }
}

/**
 * Force refresh an entire section immediately, bypassing the global auto-sync queue.
 */
export async function syncSection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { sectionId } = req.params;
    const result = await leetcodeService.syncSectionLeetCode(sectionId, {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({
      message: `Section ${result.sectionName} immediate sync completed`,
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to force refresh section' });
  }
}

/**
 * Diagnostic logs dashboard endpoints
 */
export async function getDiagnosticLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { targetType, status, search, limit } = req.query;

    const result = diagnosticLogService.getLogs({
      targetType: targetType as any,
      status: status as any,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    const summary = diagnosticLogService.getSummary();

    res.status(200).json({
      logs: result.logs,
      total: result.total,
      summary,
    });
  } catch (error: any) {
    console.error('Failed to retrieve diagnostic logs:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve diagnostic logs' });
  }
}

export async function clearDiagnosticLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    diagnosticLogService.clearLogs();
    res.status(200).json({ message: 'Diagnostic logs cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to clear diagnostic logs' });
  }
}

export async function getActiveSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const status = diagnosticLogService.getActiveSyncStatus();
    res.status(200).json(status);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve active sync status' });
  }
}

/**
 * Sync Errors tracking & retry endpoints
 */
export async function getSyncErrors(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const errors = syncErrorService.getErrors();
    res.status(200).json({
      errors,
      count: errors.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve sync errors' });
  }
}

export async function retryFailedStudent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { studentId } = req.params;
    const result = await leetcodeService.syncStudentLeetCode(studentId, {
      userId: req.user.userId,
      role: req.user.role,
    });

    res.status(200).json({
      message: `Retried sync for ${result.studentName} (@${result.leetcodeUsername})`,
      data: result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Retry attempt failed' });
  }
}

export async function retryAllFailedStudents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const errors = syncErrorService.getErrors();
    if (errors.length === 0) {
      res.status(200).json({ message: 'No failed sync records to retry', successful: 0, failed: 0 });
      return;
    }

    const results = await Promise.all(
      errors.map(async (errRecord) => {
        try {
          const res = await leetcodeService.syncStudentLeetCode(errRecord.studentId, {
            userId: req.user!.userId,
            role: req.user!.role,
          });
          return { studentId: errRecord.studentId, success: true, stats: res.stats };
        } catch (err: any) {
          return { studentId: errRecord.studentId, success: false, error: err?.message };
        }
      })
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.status(200).json({
      message: `Retried ${errors.length} failed profiles: ${successful} resolved, ${failed} still failing`,
      totalAttempted: errors.length,
      successful,
      failed,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retry sync errors' });
  }
}
