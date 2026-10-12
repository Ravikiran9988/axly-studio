import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../db/pool.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No authentication token provided.' 
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Check if user is still active in database, fetch role and session token version
    const userCheck = await query('SELECT id, is_active, role, token_version FROM users WHERE id = $1', [decoded.id]);
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'User account not found.' 
      });
    }

    if (!userCheck.rows[0].is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is disabled. Contact support.' 
      });
    }

    // Session revocation check
    const currentTokenVersion = userCheck.rows[0].token_version || 1;
    const tokenVersionInJwt = decoded.token_version || 1;
    if (tokenVersionInJwt < currentTokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Session invalidated. Please sign in again.'
      });
    }

    req.user = {
      ...decoded,
      role: userCheck.rows[0].role || decoded.role || 'user',
      token_version: currentTokenVersion,
    };
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
};

/**
 * Role-Based Access Control (RBAC) middleware
 * Ensures req.user has one of the allowed roles
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    const userRole = req.user.role || 'user';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: role '${userRole}' does not have sufficient permissions.` 
      });
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
  } catch {
    // Token invalid or expired, continue as guest
  }

  next();
};
