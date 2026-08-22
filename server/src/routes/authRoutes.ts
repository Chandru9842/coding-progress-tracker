import { Router } from 'express';
import { login, getMe, updateProfile, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getMe);
router.put('/auth/profile', requireAuth, updateProfile);
router.post('/auth/logout', logout);

export default router;
