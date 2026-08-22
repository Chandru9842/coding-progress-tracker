import { Router } from 'express';
import { getDashboardStats } from '../controllers/statsController.js';
import { requireAuth, requireStaff } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/stats/dashboard', requireAuth, requireStaff, getDashboardStats);
router.get('/stats', requireAuth, requireStaff, getDashboardStats);

export default router;
