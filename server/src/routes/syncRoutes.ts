import { Router } from 'express';
import { requireAuth, requireAdmin, requireStaff } from '../middleware/authMiddleware.js';
import {
  syncStudent,
  syncBatch,
  syncSection,
  syncAllStudents,
  syncReportFiltered,
  getStudentSnapshots,
  triggerPeriodicAutoSync,
  triggerDailyMidnightReconciliation,
  getSyncStatus,
  getDiagnosticLogs,
  clearDiagnosticLogs,
  getActiveSyncStatus,
  getSyncErrors,
  retryFailedStudent,
  retryAllFailedStudents,
} from '../controllers/syncController.js';

const router = Router();

// Status & Manual Sync Endpoints
router.get('/sync/status', requireAuth, requireStaff, getSyncStatus);
router.get('/sync/active-status', requireAuth, requireStaff, getActiveSyncStatus);
router.post('/sync/student/:studentId', requireAuth, requireStaff, syncStudent);
router.post('/sync/batch/:batchId', requireAuth, requireStaff, syncBatch);
router.post('/sync/section/:sectionId', requireAuth, requireStaff, syncSection);
router.post('/sync/all', requireAuth, requireAdmin, syncAllStudents);
router.post('/sync/report-filtered', requireAuth, requireStaff, syncReportFiltered);
router.get('/students/:studentId/snapshots', requireAuth, requireStaff, getStudentSnapshots);

// Diagnostics Dashboard Endpoints
router.get('/sync/diagnostic-logs', requireAuth, requireStaff, getDiagnosticLogs);
router.delete('/sync/diagnostic-logs', requireAuth, requireAdmin, clearDiagnosticLogs);

// Sync Errors & Retry Endpoints
router.get('/sync/errors', requireAuth, requireStaff, getSyncErrors);
router.post('/sync/errors/retry/:studentId', requireAuth, requireStaff, retryFailedStudent);
router.post('/sync/errors/retry-all', requireAuth, requireStaff, retryAllFailedStudents);

// Vercel Cron & Production Scheduled Invocations (Secured by CRON_SECRET or Admin Token)
router.get('/cron/periodic-sync', triggerPeriodicAutoSync);
router.post('/cron/periodic-sync', triggerPeriodicAutoSync);
router.get('/cron/daily-sync', triggerDailyMidnightReconciliation);
router.post('/cron/daily-sync', triggerDailyMidnightReconciliation);

export default router;
