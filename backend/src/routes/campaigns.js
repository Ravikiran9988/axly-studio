import express from 'express';
import { authenticateOrApiKey, requireScope } from '../middleware/apiKeyAuth.js';
import {
  getCampaigns,
  createCampaign,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  exportCampaignCsv
} from '../controllers/campaignController.js';

const router = express.Router();

router.get('/', authenticateOrApiKey, requireScope('campaigns:read'), getCampaigns);
router.post('/', authenticateOrApiKey, requireScope('campaigns:write'), createCampaign);
router.get('/:id/export/csv', authenticateOrApiKey, requireScope('campaigns:read'), exportCampaignCsv);
router.get('/:id', authenticateOrApiKey, requireScope('campaigns:read'), getCampaignById);
router.patch('/:id', authenticateOrApiKey, requireScope('campaigns:write'), updateCampaign);
router.delete('/:id', authenticateOrApiKey, requireScope('campaigns:write'), deleteCampaign);

export default router;
