import { Router } from 'express';
import { requireAuth, requireStaff } from '../middleware/authMiddleware.js';
import {
  getLinks,
  createLink,
  updateLink,
  getLinkDetail,
  triggerSync,
  triggerSyncAll,
  deleteLink,
  getLogs,
  getAutomationStatus,
  testWebhook,
  runDailyAutomationNow,
  getDailySyncMatrixController,
  recordSyncLogController,
  getGoogleSheetsSyncStatusController,
} from '../controllers/googleSheetsController.js';

const router = Router();

// Real-time Sync Status & Automation Health
router.get('/google-sheets/sync-status', requireAuth, requireStaff, getGoogleSheetsSyncStatusController);
router.get('/google-sheets/automation-status', requireAuth, requireStaff, getAutomationStatus);
router.post('/google-sheets/run-daily-automation', requireAuth, requireStaff, runDailyAutomationNow);
router.get('/google-sheets/daily-sync-ping', runDailyAutomationNow);
router.post('/google-sheets/daily-sync-ping', runDailyAutomationNow);

// Autonomous Scheduler Endpoints (secured by CRON_SECRET or Admin Auth)
router.get('/google-sheets/daily-sync-matrix', getDailySyncMatrixController);
router.post('/google-sheets/daily-sync-matrix', getDailySyncMatrixController);
router.post('/google-sheets/record-sync-log', recordSyncLogController);

router.get('/google-sheets/debug-matrix', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== (process.env.CRON_SECRET || 'coding_tracker_cron_secret')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { prisma } = await import('../db/client.js');
  const logs: string[] = [];
  const start = Date.now();
  try {
    logs.push(`Start: ${Date.now() - start}ms`);
    const links = await prisma.googleSheetLink.findMany({ where: { is_active: true } });
    logs.push(`Found ${links.length} active links in ${Date.now() - start}ms`);

    for (const l of links) {
      logs.push(`Link: "${l.name}", id: ${l.id}, batch_ids: ${JSON.stringify(l.batch_ids)}, url: ${l.spreadsheet_url?.slice(0, 60)}`);
    }
    const studentsCount = await prisma.student.count();
    logs.push(`Total students in DB: ${studentsCount} in ${Date.now() - start}ms`);
    const snapCount = await prisma.dailyCodingSnapshot.count();
    logs.push(`Total snapshots in DB: ${snapCount} in ${Date.now() - start}ms`);

    res.json({ logs, totalMs: Date.now() - start });
  } catch (err: any) {
    res.status(500).json({ logs, error: err.message, stack: err.stack });
  }
});

// Both ADMIN and STAFF can manage Google Sheet links for their authorized scope
router.get('/google-sheets/links', requireAuth, requireStaff, getLinks);
router.post('/google-sheets/links', requireAuth, requireStaff, createLink);
router.post('/google-sheets/links/sync-all', requireAuth, requireStaff, triggerSyncAll);
router.get('/google-sheets/links/:linkId', requireAuth, requireStaff, getLinkDetail);
router.put('/google-sheets/links/:linkId', requireAuth, requireStaff, updateLink);
router.post('/google-sheets/links/:linkId/sync', requireAuth, requireStaff, triggerSync);
router.post('/google-sheets/links/:linkId/test-webhook', requireAuth, requireStaff, testWebhook);
router.delete('/google-sheets/links/:linkId', requireAuth, requireStaff, deleteLink);
router.get('/google-sheets/links/:linkId/logs', requireAuth, requireStaff, getLogs);

export default router;
