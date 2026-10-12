import { Router } from 'express';
import { authenticateOrApiKey, requireScope } from '../middleware/apiKeyAuth.js';
import {
  listWebhooks,
  createWebhook,
  getWebhookDeliveries,
  retryWebhookDelivery,
  rotateWebhookSecret,
  deleteWebhook,
} from '../controllers/webhookController.js';

const router = Router();

router.use(authenticateOrApiKey);

router.get('/', requireScope('webhooks:read'), listWebhooks);
router.post('/', requireScope('webhooks:write'), createWebhook);
router.get('/:id/deliveries', requireScope('webhooks:read'), getWebhookDeliveries);
router.post('/:id/deliveries/:deliveryId/retry', requireScope('webhooks:write'), retryWebhookDelivery);
router.post('/:id/rotate-secret', requireScope('webhooks:write'), rotateWebhookSecret);
router.delete('/:id', requireScope('webhooks:write'), deleteWebhook);

export default router;
