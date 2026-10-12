import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getAccountAnalytics,
  exportAnalyticsCsv
} from '../controllers/analyticsController.js';

const router = express.Router();

router.use(authenticate);

router.get('/export/csv', exportAnalyticsCsv);
router.get('/', getAccountAnalytics);

export default router;
