import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { exportUserData, deleteUserAccount } from '../controllers/privacyController.js';

const router = Router();

router.use(authenticate);

router.get('/export', exportUserData);
router.delete('/account', deleteUserAccount);

export default router;
