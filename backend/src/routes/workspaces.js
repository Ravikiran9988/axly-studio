import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireWorkspaceRole } from '../middleware/workspaceAuth.js';
import {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  inviteMember,
  acceptInvite,
  updateMemberRole,
  removeMember,
  transferOwnership,
} from '../controllers/workspaceController.js';

const router = Router();

router.use(authenticate);

// Public workspace actions for authenticated user
router.get('/', listWorkspaces);
router.post('/', createWorkspace);
router.post('/invites/accept', acceptInvite);

// Workspace-scoped actions with RBAC
router.get('/:id', requireWorkspaceRole('viewer'), getWorkspace);
router.patch('/:id', requireWorkspaceRole('admin'), updateWorkspace);
router.delete('/:id', requireWorkspaceRole('owner'), deleteWorkspace);
router.post('/:id/invites', requireWorkspaceRole('admin'), inviteMember);
router.patch('/:id/members/:userId', requireWorkspaceRole('admin'), updateMemberRole);
router.delete('/:id/members/:userId', requireWorkspaceRole('admin'), removeMember);
router.post('/:id/transfer-ownership', requireWorkspaceRole('owner'), transferOwnership);

export default router;
