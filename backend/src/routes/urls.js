import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import {
  createUrl,
  getUserUrls,
  getUrl,
  updateUrl,
  deleteUrl,
  bulkUrlsAction,
  bulkImportCsv,
  exportUrlsCsv,
  getQrCode,
  getAnalytics,
  getDashboardStats
} from '../controllers/urlController.js';
import {
  getRulesForUrl,
  createRule,
  updateRule,
  deleteRule,
  reorderRules
} from '../controllers/smartRulesController.js';
import { config } from '../config/env.js';

const router = express.Router();

// Rate limiter for authenticated users (keyed by userId if present, otherwise IP)
const authUserCreateLimiter = rateLimit({
  windowMs: config.rateLimits.createWindowMs,
  max: config.rateLimits.createMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { 
    success: false, 
    message: 'Too many URLs created from this account. Please try again later.' 
  }
});

// Stricter rate limiter for anonymous guests (keyed by IP)
const guestCreateLimiter = rateLimit({
  windowMs: config.rateLimits.guestCreateWindowMs,
  max: config.rateLimits.guestCreateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    code: 'GUEST_RATE_LIMIT_EXCEEDED',
    message: 'Guest rate limit reached (10 links/hr). Please register a free Axly Studio account to create more links.' 
  }
});

// Dynamic middleware: evaluates optionalAuth first, then applies appropriate limiter
const dynamicCreateLimiter = (req, res, next) => {
  if (req.user) {
    return authUserCreateLimiter(req, res, next);
  }
  return guestCreateLimiter(req, res, next);
};

// Public/Guest creation with optionalAuth
router.post('/', optionalAuth, dynamicCreateLimiter, createUrl);

// Explicit endpoints before /:id parameter
router.get('/export/csv', authenticate, exportUrlsCsv);
router.post('/bulk', authenticate, bulkUrlsAction);
router.post('/bulk-import', authenticate, bulkImportCsv);
router.get('/stats', authenticate, getDashboardStats);
router.get('/', authenticate, getUserUrls);

// Smart redirect rules subroutes
router.get('/:urlId/rules', authenticate, getRulesForUrl);
router.post('/:urlId/rules', authenticate, createRule);
router.patch('/:urlId/rules/:ruleId', authenticate, updateRule);
router.delete('/:urlId/rules/:ruleId', authenticate, deleteRule);
router.put('/:urlId/rules/reorder', authenticate, reorderRules);

// Individual URL operations
router.get('/:id', authenticate, getUrl);
router.patch('/:id', authenticate, updateUrl);
router.delete('/:id', authenticate, deleteUrl);
router.get('/:id/qr', authenticate, getQrCode);
router.get('/:id/analytics', authenticate, getAnalytics);

export default router;
