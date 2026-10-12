import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { query } from '../db/pool.js';
import { logAuditEvent } from '../utils/audit.js';

/**
 * GET /api/workspaces - List all workspaces user is a member of
 */
export const listWorkspaces = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        w.id, w.name, w.slug, w.is_personal, w.created_at,
        wm.role as user_role,
        (SELECT COUNT(*)::int FROM workspace_members WHERE workspace_id = w.id) as member_count,
        (SELECT COUNT(*)::int FROM urls WHERE workspace_id = w.id) as link_count
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
      ORDER BY w.is_personal DESC, w.created_at ASC
    `, [req.user.id]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('listWorkspaces error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve workspaces.' });
  }
};

/**
 * GET /api/workspaces/:id - Get workspace details and member roster
 */
export const getWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    const [wsRes, membersRes, invitesRes] = await Promise.all([
      query(`
        SELECT w.id, w.name, w.slug, w.is_personal, w.owner_id, w.created_at,
               u.name as owner_name, u.email as owner_email
        FROM workspaces w
        JOIN users u ON w.owner_id = u.id
        WHERE w.id = $1
      `, [id]),
      query(`
        SELECT wm.id, wm.role, wm.created_at as joined_at,
               u.id as user_id, u.name, u.email, u.avatar_url
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id
        WHERE wm.workspace_id = $1
        ORDER BY CASE WHEN wm.role = 'owner' THEN 1 WHEN wm.role = 'admin' THEN 2 WHEN wm.role = 'editor' THEN 3 ELSE 4 END
      `, [id]),
      query(`
        SELECT id, email, role, expires_at, created_at
        FROM workspace_invitations
        WHERE workspace_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
      `, [id]),
    ]);

    if (wsRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    res.json({
      success: true,
      data: {
        workspace: wsRes.rows[0],
        members: membersRes.rows,
        pendingInvites: invitesRes.rows,
      },
    });
  } catch (err) {
    console.error('getWorkspace error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve workspace.' });
  }
};

/**
 * POST /api/workspaces - Create a team workspace
 */
export const createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Workspace name must be at least 2 characters.' });
    }

    const cleanName = name.trim();
    const slugBase = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'team';
    const slug = `${slugBase}-${nanoid(6).toLowerCase()}`;

    // Insert workspace
    const wsRes = await query(`
      INSERT INTO workspaces (name, slug, owner_id, is_personal)
      VALUES ($1, $2, $3, false)
      RETURNING id, name, slug, is_personal, created_at
    `, [cleanName, slug, req.user.id]);

    const workspace = wsRes.rows[0];

    // Add creator as 'owner'
    await query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, 'owner')
    `, [workspace.id, req.user.id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'workspace.create',
      targetType: 'workspace',
      targetId: workspace.id,
      details: { name: workspace.name, slug: workspace.slug },
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully.',
      data: workspace,
    });
  } catch (err) {
    console.error('createWorkspace error:', err);
    res.status(500).json({ success: false, message: 'Failed to create workspace.' });
  }
};

/**
 * PATCH /api/workspaces/:id - Update workspace details
 */
export const updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Workspace name must be at least 2 characters.' });
    }

    const result = await query(`
      UPDATE workspaces
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, slug, updated_at
    `, [name.trim(), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    res.json({
      success: true,
      message: 'Workspace updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('updateWorkspace error:', err);
    res.status(500).json({ success: false, message: 'Failed to update workspace.' });
  }
};

/**
 * DELETE /api/workspaces/:id - Delete team workspace (Owner only)
 */
export const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    const ws = await query('SELECT is_personal, owner_id, name FROM workspaces WHERE id = $1', [id]);
    if (ws.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    if (ws.rows[0].is_personal) {
      return res.status(400).json({ success: false, message: 'Default personal workspaces cannot be deleted.' });
    }

    if (ws.rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can delete this workspace.' });
    }

    await query('DELETE FROM workspaces WHERE id = $1', [id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'workspace.delete',
      targetType: 'workspace',
      targetId: id,
      details: { name: ws.rows[0].name },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Workspace deleted successfully.',
    });
  } catch (err) {
    console.error('deleteWorkspace error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete workspace.' });
  }
};

/**
 * POST /api/workspaces/:id/invites - Invite a teammate
 */
export const inviteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role = 'viewer' } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid member email is required.' });
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be admin, editor, or viewer.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if already a member
    const existingMember = await query(`
      SELECT wm.id FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1 AND u.email = $2
    `, [id, cleanEmail]);

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User is already a member of this workspace.' });
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    await query(`
      INSERT INTO workspace_invitations (
        workspace_id, email, role, token_hash, invited_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, cleanEmail, role, tokenHash, req.user.id, expiresAt]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'workspace.invite',
      targetType: 'workspace',
      targetId: id,
      details: { invitedEmail: cleanEmail, role },
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Workspace invitation generated.',
      data: {
        email: cleanEmail,
        role,
        expiresAt,
        inviteToken: rawToken, // Token provided for testing & shareable link
        shareableLink: `/invite/accept?token=${rawToken}`,
      },
    });
  } catch (err) {
    console.error('inviteMember error:', err);
    res.status(500).json({ success: false, message: 'Failed to invite member.' });
  }
};

/**
 * POST /api/workspaces/invites/accept - Accept an invitation token
 */
export const acceptInvite = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Invitation token is required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const inviteRes = await query(`
      SELECT id, workspace_id, email, role, expires_at, accepted_at
      FROM workspace_invitations
      WHERE token_hash = $1
    `, [tokenHash]);

    if (inviteRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid invitation token.' });
    }

    const invite = inviteRes.rows[0];

    if (invite.accepted_at) {
      return res.status(400).json({ success: false, message: 'This invitation has already been accepted.' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'This invitation has expired.' });
    }

    // Add user as member
    await query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (workspace_id, user_id) 
      DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
    `, [invite.workspace_id, req.user.id, invite.role]);

    // Mark invitation accepted
    await query(`
      UPDATE workspace_invitations SET accepted_at = NOW() WHERE id = $1
    `, [invite.id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'workspace.join',
      targetType: 'workspace',
      targetId: invite.workspace_id,
      details: { role: invite.role },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Invitation accepted! You have successfully joined the workspace.',
      workspaceId: invite.workspace_id,
    });
  } catch (err) {
    console.error('acceptInvite error:', err);
    res.status(500).json({ success: false, message: 'Failed to accept invitation.' });
  }
};

/**
 * PATCH /api/workspaces/:id/members/:userId - Update member role
 */
export const updateMemberRole = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be admin, editor, or viewer.' });
    }

    // Cannot change owner role through this endpoint
    const targetCheck = await query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [id, userId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({ success: false, message: 'Owner role cannot be modified; transfer ownership instead.' });
    }

    await query(`
      UPDATE workspace_members SET role = $1, updated_at = NOW()
      WHERE workspace_id = $2 AND user_id = $3
    `, [role, id, userId]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'workspace.member_role',
      targetType: 'workspace',
      targetId: id,
      details: { targetUserId: userId, newRole: role },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Member role updated to ${role}.`,
    });
  } catch (err) {
    console.error('updateMemberRole error:', err);
    res.status(500).json({ success: false, message: 'Failed to update member role.' });
  }
};

/**
 * DELETE /api/workspaces/:id/members/:userId - Remove member
 */
export const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const targetCheck = await query('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [id, userId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({ success: false, message: 'The workspace owner cannot be removed.' });
    }

    await query('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [id, userId]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'workspace.member_remove',
      targetType: 'workspace',
      targetId: id,
      details: { removedUserId: userId },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Member removed from workspace.',
    });
  } catch (err) {
    console.error('removeMember error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove member.' });
  }
};

/**
 * POST /api/workspaces/:id/transfer-ownership - Safe ownership transfer
 */
export const transferOwnership = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required.' });
    }

    const ws = await query('SELECT owner_id, name FROM workspaces WHERE id = $1', [id]);
    if (ws.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    if (ws.rows[0].owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only current owner can transfer ownership.' });
    }

    // Verify target user is an active member of this workspace
    const targetMember = await query(`
      SELECT u.id, u.email FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1 AND wm.user_id = $2
    `, [id, targetUserId]);

    if (targetMember.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Target user is not a member of this workspace.' });
    }

    // Atomic transaction for ownership transfer
    await query('BEGIN');
    try {
      // Set new owner on workspace
      await query('UPDATE workspaces SET owner_id = $1, updated_at = NOW() WHERE id = $2', [targetUserId, id]);
      // Demote current owner to admin
      await query('UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3', ['admin', id, req.user.id]);
      // Promote target member to owner
      await query('UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3', ['owner', id, targetUserId]);
      await query('COMMIT');
    } catch (txErr) {
      await query('ROLLBACK');
      throw txErr;
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'workspace.transfer_ownership',
      targetType: 'workspace',
      targetId: id,
      details: { previousOwner: req.user.id, newOwner: targetUserId },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Workspace ownership successfully transferred to ${targetMember.rows[0].email}.`,
    });
  } catch (err) {
    console.error('transferOwnership error:', err);
    res.status(500).json({ success: false, message: 'Failed to transfer ownership.' });
  }
};
