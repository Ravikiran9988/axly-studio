import { query } from '../db/pool.js';
import { validateSafeDestinationUrl } from '../utils/ssrf.js';

// Verify that the URL belongs to the authenticated user
const verifyUrlOwnership = async (urlId, userId) => {
  const res = await query('SELECT id FROM urls WHERE id = $1 AND user_id = $2', [urlId, userId]);
  return res.rows.length > 0;
};

// GET /api/urls/:urlId/rules - List smart redirect rules for a short link
export const getRulesForUrl = async (req, res) => {
  try {
    const { urlId } = req.params;
    const userId = req.user.id;

    const isOwner = await verifyUrlOwnership(urlId, userId);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    const result = await query(
      `SELECT id, url_id, priority, is_active, rule_type, match_value, destination_url, 
              start_time, end_time, timezone, created_at, updated_at
       FROM smart_redirect_rules 
       WHERE url_id = $1 
       ORDER BY priority ASC, created_at ASC`,
      [urlId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getRulesForUrl error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve smart redirect rules.' });
  }
};

// POST /api/urls/:urlId/rules - Create a new smart redirect rule
export const createRule = async (req, res) => {
  try {
    const { urlId } = req.params;
    const userId = req.user.id;
    const { ruleType, matchValue, destinationUrl, startTime, endTime, timezone, priority, isActive } = req.body;

    const isOwner = await verifyUrlOwnership(urlId, userId);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    // Validation
    if (!['device', 'time'].includes(ruleType)) {
      return res.status(400).json({ success: false, message: 'ruleType must be either "device" or "time".' });
    }

    if (ruleType === 'device' && !['mobile', 'desktop', 'tablet'].includes(matchValue?.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'For device rules, matchValue must be "mobile", "desktop", or "tablet".' });
    }

    if (ruleType === 'time') {
      if (!startTime || !endTime) {
        return res.status(400).json({ success: false, message: 'Time rules require both startTime and endTime (HH:MM:SS).' });
      }
    }

    // SSRF validation
    const ssrfCheck = validateSafeDestinationUrl(destinationUrl);
    if (!ssrfCheck.valid) {
      return res.status(400).json({ success: false, message: ssrfCheck.error });
    }

    // Rule limit per URL (max 25)
    const countRes = await query('SELECT COUNT(*) FROM smart_redirect_rules WHERE url_id = $1', [urlId]);
    if (parseInt(countRes.rows[0].count, 10) >= 25) {
      return res.status(400).json({ success: false, message: 'Maximum 25 smart redirect rules per short link reached.' });
    }

    const cleanPriority = Number.isInteger(priority) ? priority : 0;
    const cleanIsActive = isActive !== false;
    const cleanTz = (timezone && typeof timezone === 'string') ? timezone.trim() : 'UTC';

    const insertRes = await query(
      `INSERT INTO smart_redirect_rules 
        (url_id, priority, is_active, rule_type, match_value, destination_url, start_time, end_time, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        urlId,
        cleanPriority,
        cleanIsActive,
        ruleType,
        matchValue ? matchValue.toLowerCase() : null,
        ssrfCheck.url,
        startTime || null,
        endTime || null,
        cleanTz
      ]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Smart redirect rule created successfully.', 
      data: insertRes.rows[0] 
    });
  } catch (err) {
    console.error('createRule error:', err);
    res.status(500).json({ success: false, message: 'Failed to create smart redirect rule.' });
  }
};

// PATCH /api/urls/:urlId/rules/:ruleId - Update rule
export const updateRule = async (req, res) => {
  try {
    const { urlId, ruleId } = req.params;
    const userId = req.user.id;
    const { ruleType, matchValue, destinationUrl, startTime, endTime, timezone, priority, isActive } = req.body;

    const isOwner = await verifyUrlOwnership(urlId, userId);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    // Check rule exists
    const ruleRes = await query('SELECT id FROM smart_redirect_rules WHERE id = $1 AND url_id = $2', [ruleId, urlId]);
    if (ruleRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }

    const updates = [];
    const params = [];

    if (ruleType !== undefined) {
      if (!['device', 'time'].includes(ruleType)) {
        return res.status(400).json({ success: false, message: 'ruleType must be "device" or "time".' });
      }
      params.push(ruleType);
      updates.push(`rule_type = $${params.length}`);
    }

    if (matchValue !== undefined) {
      params.push(matchValue ? matchValue.toLowerCase() : null);
      updates.push(`match_value = $${params.length}`);
    }

    if (destinationUrl !== undefined) {
      const ssrfCheck = validateSafeDestinationUrl(destinationUrl);
      if (!ssrfCheck.valid) {
        return res.status(400).json({ success: false, message: ssrfCheck.error });
      }
      params.push(ssrfCheck.url);
      updates.push(`destination_url = $${params.length}`);
    }

    if (startTime !== undefined) {
      params.push(startTime || null);
      updates.push(`start_time = $${params.length}`);
    }

    if (endTime !== undefined) {
      params.push(endTime || null);
      updates.push(`end_time = $${params.length}`);
    }

    if (timezone !== undefined) {
      params.push(timezone || 'UTC');
      updates.push(`timezone = $${params.length}`);
    }

    if (priority !== undefined) {
      params.push(Number.isInteger(priority) ? priority : 0);
      updates.push(`priority = $${params.length}`);
    }

    if (isActive !== undefined) {
      params.push(Boolean(isActive));
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No changes provided.' });
    }

    updates.push('updated_at = NOW()');
    params.push(ruleId, urlId);

    const updateQuery = `
      UPDATE smart_redirect_rules 
      SET ${updates.join(', ')} 
      WHERE id = $${params.length - 1} AND url_id = $${params.length} 
      RETURNING *
    `;

    const result = await query(updateQuery, params);
    res.json({ success: true, message: 'Rule updated successfully.', data: result.rows[0] });
  } catch (err) {
    console.error('updateRule error:', err);
    res.status(500).json({ success: false, message: 'Failed to update smart redirect rule.' });
  }
};

// DELETE /api/urls/:urlId/rules/:ruleId - Delete rule
export const deleteRule = async (req, res) => {
  try {
    const { urlId, ruleId } = req.params;
    const userId = req.user.id;

    const isOwner = await verifyUrlOwnership(urlId, userId);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    const delRes = await query(
      'DELETE FROM smart_redirect_rules WHERE id = $1 AND url_id = $2 RETURNING id',
      [ruleId, urlId]
    );

    if (delRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }

    res.json({ success: true, message: 'Smart redirect rule deleted successfully.' });
  } catch (err) {
    console.error('deleteRule error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete smart redirect rule.' });
  }
};

// PUT /api/urls/:urlId/rules/reorder - Batch reorder priorities
export const reorderRules = async (req, res) => {
  try {
    const { urlId } = req.params;
    const userId = req.user.id;
    const { ruleIds } = req.body;

    if (!Array.isArray(ruleIds)) {
      return res.status(400).json({ success: false, message: 'ruleIds must be an array of rule IDs.' });
    }

    const isOwner = await verifyUrlOwnership(urlId, userId);
    if (!isOwner) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    for (let i = 0; i < ruleIds.length; i++) {
      await query(
        'UPDATE smart_redirect_rules SET priority = $1 WHERE id = $2 AND url_id = $3',
        [i, ruleIds[i], urlId]
      );
    }

    res.json({ success: true, message: 'Rules reordered successfully.' });
  } catch (err) {
    console.error('reorderRules error:', err);
    res.status(500).json({ success: false, message: 'Failed to reorder rules.' });
  }
};
