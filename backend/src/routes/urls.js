import express from 'express';
import rateLimit from 'express-rate-limit';
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
import { config } from '../config/env.js';

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: config.rateLimits.createWindowMs,
  max: config.rateLimits.createMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    message: 'Too many URLs created. Please try again in an hour.' 
  }
});

router.post('/', createLimiter, optionalAuth, createUrl);
router.get('/', authenticate, getUserUrls);
router.get('/stats', authenticate, getDashboardStats);
router.get('/:id', authenticate, getUrl);
router.patch('/:id', authenticate, updateUrl);
router.delete('/:id', authenticate, deleteUrl);
router.get('/:id/qr', authenticate, getQrCode);
router.get('/:id/analytics', authenticate, getAnalytics);

export default router;
