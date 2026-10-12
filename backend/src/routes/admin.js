import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getAdminStats,
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  getAdminUrls,
  deleteAdminUrl
} from '../controllers/adminController.js';

const router = express.Router();

// Enforce both authentication AND admin privileges across all admin routes
router.use(authenticate, requireAdmin);

// Dashboard metrics
router.get('/stats', getAdminStats);

// User management
router.get('/users', getAdminUsers);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);

// System-wide URLs
router.get('/urls', getAdminUrls);
router.delete('/urls/:id', deleteAdminUrl);

export default router;
