import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import {
  getStaffList,
  getStaffDetail,
  createStaff,
  updateStaff,
  deleteStaff,
  updateStaffStatus,
  resetStaffPassword,
  assignBatches,
  assignSection,
  removeSection,
  assignStudents,
  removeStudent,
  getStaffAssignedScopes,
} from '../controllers/staffController.js';

const router = Router();

// All staff management routes are ADMIN only
// NOTE: We apply requireAuth + requireAdmin per-route instead of router.use()
// because router.use() would intercept ALL /api/v1/* requests (since this router
// is mounted on /api/v1) and block non-ADMIN users from reaching subsequent routers.

router.get('/staff/me/assigned-scopes', requireAuth, getStaffAssignedScopes);
router.get('/staff', requireAuth, getStaffList);
router.post('/staff', requireAuth, requireAdmin, createStaff);
router.get('/staff/:staffId', requireAuth, requireAdmin, getStaffDetail);
router.patch('/staff/:staffId', requireAuth, requireAdmin, updateStaff);
router.delete('/staff/:staffId', requireAuth, requireAdmin, deleteStaff);
router.patch('/staff/:staffId/status', requireAuth, requireAdmin, updateStaffStatus);
router.patch('/staff/:staffId/password', requireAuth, requireAdmin, resetStaffPassword);

router.post('/staff/:staffId/batches', requireAuth, requireAdmin, assignBatches);
router.post('/staff/:staffId/sections', requireAuth, requireAdmin, assignSection);
router.delete('/staff/:staffId/sections/:sectionId', requireAuth, requireAdmin, removeSection);
router.post('/staff/:staffId/students', requireAuth, requireAdmin, assignStudents);
router.delete('/staff/:staffId/students/:studentId', requireAuth, requireAdmin, removeStudent);

export default router;
