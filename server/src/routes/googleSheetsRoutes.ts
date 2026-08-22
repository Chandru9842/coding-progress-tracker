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
} from '../controllers/googleSheetsController.js';

const router = Router();

// Both ADMIN and STAFF can manage Google Sheet links for their authorized scope
router.get('/google-sheets/links', requireAuth, requireStaff, getLinks);
router.post('/google-sheets/links', requireAuth, requireStaff, createLink);
router.post('/google-sheets/links/sync-all', requireAuth, requireStaff, triggerSyncAll);
router.get('/google-sheets/links/:linkId', requireAuth, requireStaff, getLinkDetail);
router.put('/google-sheets/links/:linkId', requireAuth, requireStaff, updateLink);
router.post('/google-sheets/links/:linkId/sync', requireAuth, requireStaff, triggerSync);
router.delete('/google-sheets/links/:linkId', requireAuth, requireStaff, deleteLink);
router.get('/google-sheets/links/:linkId/logs', requireAuth, requireStaff, getLogs);

export default router;
