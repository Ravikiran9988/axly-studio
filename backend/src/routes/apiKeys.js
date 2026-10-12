import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
} from '../controllers/apiKeyController.js';

const router = Router();

// API key lifecycle endpoints require standard user authentication
router.use(authenticate);

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.delete('/:id', revokeApiKey);
router.post('/:id/rotate', rotateApiKey);

export default router;
