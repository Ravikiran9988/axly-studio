import express from 'express';
import { authenticateOrApiKey, requireScope } from '../middleware/apiKeyAuth.js';
import {
  getExperiments,
  createExperiment,
  getExperimentById,
  updateExperiment,
  deleteExperiment,
  recordConversion
} from '../controllers/experimentController.js';

const router = express.Router();

// Public conversion tracking endpoint
router.post('/:id/convert', recordConversion);

// Authenticated or API Key experiment management
router.get('/', authenticateOrApiKey, requireScope('experiments:read'), getExperiments);
router.post('/', authenticateOrApiKey, requireScope('experiments:write'), createExperiment);
router.get('/:id', authenticateOrApiKey, requireScope('experiments:read'), getExperimentById);
router.patch('/:id', authenticateOrApiKey, requireScope('experiments:write'), updateExperiment);
router.delete('/:id', authenticateOrApiKey, requireScope('experiments:write'), deleteExperiment);

export default router;
