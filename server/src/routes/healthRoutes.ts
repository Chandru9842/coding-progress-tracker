import { Router } from 'express';
import { checkHealth } from '../controllers/healthController.js';

const router = Router();

router.get('/health', checkHealth);

export default router;
