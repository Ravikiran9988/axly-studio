import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import {
  generateLinkCode,
  verifyLink,
  getTelegramSession,
  getStatus,
  unlinkTelegram,
} from '../controllers/telegramController.js';

const router = express.Router();

// Strict rate limiter for account linking code generation and verification (anti-brute-force)
const linkRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many account linking attempts. Please try again in 15 minutes.',
  },
});

// Authenticated web user routes
router.post('/link-code', authenticate, linkRateLimiter, generateLinkCode);
router.get('/status', authenticate, getStatus);

// Verification endpoint called by Telegram Bot or web client
router.post('/verify', linkRateLimiter, verifyLink);

// Service-to-service endpoints for Telegram Bot
router.post('/session', getTelegramSession);
router.post('/unlink', optionalAuth, unlinkTelegram);

export default router;
