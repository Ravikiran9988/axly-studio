import express from 'express';
import { authenticateOrApiKey, requireScope } from '../middleware/apiKeyAuth.js';
import {
  getAccountAnalytics,
  exportAnalyticsCsv
} from '../controllers/analyticsController.js';

const router = express.Router();

router.use(authenticateOrApiKey, requireScope('analytics:read'));

router.get('/export/csv', exportAnalyticsCsv);
router.get('/', getAccountAnalytics);

export default router;
