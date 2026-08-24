import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as reportController from '../controllers/reportController.js';

const router = Router();

router.use(requireAuth);

router.get('/filters', reportController.getReportFilters);
router.get('/data', reportController.getReportData);
router.get('/student/:studentId/daily-progress', reportController.getStudentDailyProgress);
router.post('/export-csv', reportController.exportCsvReport);
router.post('/export-excel', reportController.exportExcelReport);
router.post('/generate', reportController.generateReport);
router.get('/', reportController.listReports);
router.post('/bulk-delete', reportController.bulkDeleteReports);
router.delete('/clear-all', reportController.clearAllReports);
router.delete('/:reportId', reportController.deleteReport);
router.get('/:reportId/download', reportController.downloadReport);

export default router;
