import express from 'express';
import { authenticate } from '../middleware/auth.js';
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

// Authenticated experiment management
router.get('/', authenticate, getExperiments);
router.post('/', authenticate, createExperiment);
router.get('/:id', authenticate, getExperimentById);
router.patch('/:id', authenticate, updateExperiment);
router.delete('/:id', authenticate, deleteExperiment);

export default router;
