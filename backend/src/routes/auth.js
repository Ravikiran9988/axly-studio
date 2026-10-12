import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/env.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: config.rateLimits.authWindowMs,
  max: config.rateLimits.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    message: 'Too many authentication attempts. Please try again in 15 minutes.' 
  }
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authenticate, getMe);

export default router;
