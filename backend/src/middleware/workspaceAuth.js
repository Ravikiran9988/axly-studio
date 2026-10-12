import { query } from '../db/pool.js';

const ROLE_RANKS = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

/**
 * Middleware: Verify user is a member of the workspace with at least `minRole`
 */
export const requireWorkspaceRole = (minRole = 'viewer') => {
  return async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId || req.params.id || req.body.workspaceId || req.headers['x-workspace-id'];

      if (!workspaceId) {
        return res.status(400).json({ success: false, message: 'Workspace ID required.' });
      }

      // System administrators have global authority
      if (req.user?.role === 'admin') {
        req.workspaceId = workspaceId;
        req.workspaceRole = 'owner';
        return next();
      }

      const result = await query(`
        SELECT role FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2
      `, [workspaceId, req.user.id]);

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a member of this workspace.',
        });
      }

      const userRole = result.rows[0].role;
      const userRank = ROLE_RANKS[userRole] || 0;
      const requiredRank = ROLE_RANKS[minRole] || 1;

      if (userRank < requiredRank) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: This action requires at least '${minRole}' role in this workspace.`,
          currentRole: userRole,
          requiredRole: minRole,
        });
      }

      req.workspaceId = workspaceId;
      req.workspaceRole = userRole;
      next();
    } catch (err) {
      console.error('requireWorkspaceRole error:', err);
      res.status(500).json({ success: false, message: 'Authorization check failed.' });
    }
  };
};
