import { Router } from 'express';
import { requireAuth, requireAdmin, requireStaff } from '../middleware/authMiddleware.js';
import {
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchDetail,
  createSection,
  updateSection,
  deleteSection,
  getBatchSections,
  getAllocationBatches,
  createAllocationBatch,
  updateAllocationBatch,
  deleteAllocationBatch,
  assignStudentsToAllocationBatch,
} from '../controllers/batchController.js';

const router = Router();

router.use(requireAuth);

router.get('/batches', requireStaff, getBatches);
router.post('/batches', requireAdmin, createBatch);
router.get('/batches/:batchId', requireStaff, getBatchDetail);
router.patch('/batches/:batchId', requireAdmin, updateBatch);
router.delete('/batches/:batchId', requireAdmin, deleteBatch);

router.post('/batches/:batchId/sections', requireAdmin, createSection);
router.patch('/sections/:sectionId', requireAdmin, updateSection);
router.delete('/sections/:sectionId', requireAdmin, deleteSection);
router.get('/batches/:batchId/sections', requireStaff, getBatchSections);

router.get('/sections/:sectionId/allocation-batches', requireStaff, getAllocationBatches);
router.post('/sections/:sectionId/allocation-batches', requireAdmin, createAllocationBatch);
router.patch('/sections/:sectionId/allocation-batches/:allocationBatchId', requireAdmin, updateAllocationBatch);
router.delete('/sections/:sectionId/allocation-batches/:allocationBatchId', requireAdmin, deleteAllocationBatch);
router.post('/sections/:sectionId/allocation-batches/:allocationBatchId/students', requireAdmin, assignStudentsToAllocationBatch);

export default router;
