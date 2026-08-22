import { Router } from 'express';
import { requireAuth, requireAdmin, requireStaff } from '../middleware/authMiddleware.js';
import {
  syncStudent,
  syncBatch,
  syncAllStudents,
  syncReportFiltered,
  getStudentSnapshots,
  triggerPeriodicAutoSync,
  triggerDailyMidnightReconciliation,
  getSyncStatus,
} from '../controllers/syncController.js';

const router = Router();

// Status & Manual Sync Endpoints
router.get('/sync/status', requireAuth, requireStaff, getSyncStatus);
router.post('/sync/student/:studentId', requireAuth, requireStaff, syncStudent);
router.post('/sync/batch/:batchId', requireAuth, requireStaff, syncBatch);
router.post('/sync/all', requireAuth, requireAdmin, syncAllStudents);
router.post('/sync/report-filtered', requireAuth, requireStaff, syncReportFiltered);
router.get('/students/:studentId/snapshots', requireAuth, requireStaff, getStudentSnapshots);

// Vercel Cron & Production Scheduled Invocations (Secured by CRON_SECRET or Admin Token)
router.get('/cron/periodic-sync', triggerPeriodicAutoSync);
router.post('/cron/periodic-sync', triggerPeriodicAutoSync);
router.get('/cron/daily-sync', triggerDailyMidnightReconciliation);
router.post('/cron/daily-sync', triggerDailyMidnightReconciliation);

export default router;
