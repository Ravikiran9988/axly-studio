import { query } from '../db/pool.js';

/**
 * GET /api/notifications - List notifications for the authenticated user
 */
export const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [notifRes, unreadRes] = await Promise.all([
      query(`
        SELECT id, type, title, message, metadata, is_read, created_at
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [req.user.id, limit, offset]),
      query(`
        SELECT COUNT(*)::int as unread_count
        FROM notifications
        WHERE user_id = $1 AND is_read = false
      `, [req.user.id]),
    ]);

    const rawUnread = unreadRes.rows[0]?.unread_count ?? unreadRes.rows[0]?.unread ?? 0;
    const unreadCount = parseInt(rawUnread, 10) || 0;

    res.json({
      success: true,
      data: notifRes.rows,
      notifications: notifRes.rows,
      unreadCount,
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
};

/**
 * PATCH /api/notifications/:id/read - Mark single notification as read
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      RETURNING id, is_read
    `, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    res.json({
      success: true,
      message: 'Notification marked as read.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('markNotificationRead error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
};

/**
 * POST /api/notifications/mark-all-read - Mark all as read
 */
export const markAllRead = async (req, res) => {
  try {
    await query(`
      UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false
    `, [req.user.id]);

    res.json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (err) {
    console.error('markAllRead error:', err);
    res.status(500).json({ success: false, message: 'Failed to mark notifications.' });
  }
};

/**
 * Helper: Insert in-app notification
 */
export const createNotification = async ({ userId, type, title, message, metadata = {} }) => {
  try {
    await query(`
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, type, title, message, JSON.stringify(metadata)]);
  } catch (err) {
    console.error('createNotification helper error:', err);
  }
};
