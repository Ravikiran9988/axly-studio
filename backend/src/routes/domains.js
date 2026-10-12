import { Router } from 'express';
import { authenticateOrApiKey, requireScope } from '../middleware/apiKeyAuth.js';
import {
  listDomains,
  createDomain,
  verifyDomain,
  deleteDomain,
} from '../controllers/domainController.js';

const router = Router();

router.use(authenticateOrApiKey);

router.get('/', requireScope('domains:read'), listDomains);
router.post('/', requireScope('domains:write'), createDomain);
router.post('/:id/verify', requireScope('domains:write'), verifyDomain);
router.delete('/:id', requireScope('domains:write'), deleteDomain);

export default router;
