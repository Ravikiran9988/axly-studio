import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { authenticateOrApiKey, requireScope } from '../middleware/apiKeyAuth.js';
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

// Authenticated requests are keyed by stable account ID; guest requests use the IP-keyed limiter below.
const authUserCreateLimiter = rateLimit({
  windowMs: config.rateLimits.createWindowMs,
  max: config.rateLimits.createMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
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

// Public/Guest creation with optionalAuth (and links:write scope check if API key is provided)
router.post('/', optionalAuth, requireScope('links:write'), dynamicCreateLimiter, createUrl);

// Explicit endpoints before /:id parameter
router.get('/export/csv', authenticateOrApiKey, requireScope('links:read'), exportUrlsCsv);
router.post('/bulk', authenticateOrApiKey, requireScope('links:write'), bulkUrlsAction);
router.post('/bulk-import', authenticateOrApiKey, requireScope('links:write'), bulkImportCsv);
router.get('/stats', authenticateOrApiKey, requireScope('analytics:read'), getDashboardStats);
router.get('/', authenticateOrApiKey, requireScope('links:read'), getUserUrls);

// Smart redirect rules subroutes
router.get('/:urlId/rules', authenticateOrApiKey, requireScope('links:read'), getRulesForUrl);
router.post('/:urlId/rules', authenticateOrApiKey, requireScope('links:write'), createRule);
router.patch('/:urlId/rules/:ruleId', authenticateOrApiKey, requireScope('links:write'), updateRule);
router.delete('/:urlId/rules/:ruleId', authenticateOrApiKey, requireScope('links:write'), deleteRule);
router.put('/:urlId/rules/reorder', authenticateOrApiKey, requireScope('links:write'), reorderRules);

// Individual URL operations
router.get('/:id', authenticateOrApiKey, requireScope('links:read'), getUrl);
router.patch('/:id', authenticateOrApiKey, requireScope('links:write'), updateUrl);
router.delete('/:id', authenticateOrApiKey, requireScope('links:write'), deleteUrl);
router.get('/:id/qr', authenticateOrApiKey, requireScope('links:read'), getQrCode);
router.get('/:id/analytics', authenticateOrApiKey, requireScope('analytics:read'), getAnalytics);

export default router;
