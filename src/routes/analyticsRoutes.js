import { Router } from 'express';

import { getAnalyticsOverview } from '../controllers/analyticsController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.get('/overview', authMiddleware, getAnalyticsOverview);

export default router;
