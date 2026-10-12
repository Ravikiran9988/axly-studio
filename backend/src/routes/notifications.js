import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getNotifications,
  markNotificationRead,
  markAllRead,
} from '../controllers/notificationController.js';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markNotificationRead);
router.post('/mark-all-read', markAllRead);

export default router;
