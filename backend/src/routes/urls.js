import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import {
  createUrl,
  getUserUrls,
  getUrl,
  updateUrl,
  deleteUrl,
  getQrCode,
  getAnalytics,
  getDashboardStats
} from '../controllers/urlController.js';

const router = express.Router();

router.post('/', optionalAuth, createUrl);
router.get('/', authenticate, getUserUrls);
router.get('/stats', authenticate, getDashboardStats);
router.get('/:id', authenticate, getUrl);
router.patch('/:id', authenticate, updateUrl);
router.delete('/:id', authenticate, deleteUrl);
router.get('/:id/qr', authenticate, getQrCode);
router.get('/:id/analytics', authenticate, getAnalytics);

export default router;
