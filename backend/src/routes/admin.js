import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getAdminStats,
  getAdminUsers,
  updateUserRole,
  updateUserStatus,
  revokeUserSessions,
  getUserActivity,
  getAdminUrls,
  deleteAdminUrl,
  getModerationReports,
  updateReportStatus,
  moderateUrl,
  getHealthOverview,
  triggerLinkHealthCheck,
  getPlatformSettings,
  updatePlatformSettings,
  getAuditLogs
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
router.post('/users/:id/revoke-sessions', revokeUserSessions);
router.get('/users/:id/activity', getUserActivity);

// System-wide URLs & Moderation
router.get('/urls', getAdminUrls);
router.delete('/urls/:id', deleteAdminUrl);
router.patch('/urls/:id/moderation', moderateUrl);

// Moderation reports queue
router.get('/moderation/reports', getModerationReports);
router.patch('/moderation/reports/:id', updateReportStatus);

// Link health monitoring
router.get('/health', getHealthOverview);
router.post('/health/check/:id', triggerLinkHealthCheck);

// Platform configuration & operational settings
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSettings);

// Audit trail
router.get('/audit', getAuditLogs);

export default router;

