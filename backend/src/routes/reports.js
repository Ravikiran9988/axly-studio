import { Router } from 'express';
import { submitReport } from '../controllers/reportController.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Strict rate limit for abuse reporting to prevent spamming reports
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many reports submitted. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', reportLimiter, submitReport);

export default router;
