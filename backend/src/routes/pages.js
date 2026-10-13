import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createPage, deletePage, duplicatePage, getPage, getPageAnalytics,
  getPublicPageByDomain, getPublicPageBySlug, listPageLeads, listPages,
  pageTemplates, publicLeadLimiter, recordPublicPageEvent, submitPageLead,
  suggestPageCopy, updatePage,
} from '../controllers/pageController.js';

const router = Router();

// Public read-only templates and published-page APIs.
router.get('/public/templates', pageTemplates);
router.get('/public/resolve', getPublicPageByDomain);
router.get('/public/slug/:slug', getPublicPageBySlug);
router.post('/public/slug/:slug/events', recordPublicPageEvent);
router.post('/public/slug/:slug/leads', publicLeadLimiter, submitPageLead);

// Builder operations always require a verified session; API keys intentionally cannot administer pages.
router.use(authenticate);
router.get('/', listPages);
router.post('/', createPage);
router.get('/:id/analytics', getPageAnalytics);
router.get('/:id/leads', listPageLeads);
router.post('/:id/duplicate', duplicatePage);
router.post('/:id/ai-copy', suggestPageCopy);
router.get('/:id', getPage);
router.patch('/:id', updatePage);
router.delete('/:id', deletePage);

export default router;
