import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getCampaigns,
  createCampaign,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  exportCampaignCsv
} from '../controllers/campaignController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.get('/:id/export/csv', exportCampaignCsv);
router.get('/:id', getCampaignById);
router.patch('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

export default router;
