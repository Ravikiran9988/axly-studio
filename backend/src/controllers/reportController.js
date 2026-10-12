import { query } from '../db/pool.js';
import { hashIp } from '../utils/audit.js';

const VALID_REASONS = ['phishing', 'malware', 'spam', 'copyright', 'harassment', 'other'];

/**
 * POST /api/reports - Public visitor abuse report submission
 */
export const submitReport = async (req, res) => {
  try {
    const { shortCode, urlId, reason, details, reporterEmail } = req.body;

    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Invalid reason. Allowed reasons: ${VALID_REASONS.join(', ')}`,
      });
    }

    if (!shortCode && !urlId) {
      return res.status(400).json({
        success: false,
        message: 'Must provide either shortCode or urlId to report.',
      });
    }

    // Lookup link
    let urlResult;
    if (urlId) {
      urlResult = await query('SELECT id, short_code FROM urls WHERE id = $1', [urlId]);
    } else {
      urlResult = await query('SELECT id, short_code FROM urls WHERE short_code = $1', [shortCode.trim()]);
    }

    if (urlResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reported link not found.',
      });
    }

    const targetUrl = urlResult.rows[0];
    const ipHash = hashIp(req.ip || req.headers['x-forwarded-for']);

    // Insert into link_reports
    const reportResult = await query(`
      INSERT INTO link_reports (
        url_id, short_code, reporter_ip_hash, reporter_email, reason, details, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id, short_code, reason, status, created_at
    `, [
      targetUrl.id,
      targetUrl.short_code,
      ipHash,
      reporterEmail ? String(reporterEmail).trim().slice(0, 255) : null,
      reason,
      details ? String(details).trim().slice(0, 1000) : null,
    ]);

    // Check count of pending reports for this link
    const countRes = await query(
      "SELECT COUNT(*)::int as count FROM link_reports WHERE url_id = $1 AND status = 'pending'",
      [targetUrl.id]
    );

    if (countRes.rows[0].count >= 3) {
      // Flag for review automatically if multiple reports received
      await query(
        "UPDATE urls SET moderation_status = 'under_review' WHERE id = $1 AND moderation_status = 'approved'",
        [targetUrl.id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Our operations and safety team will review this link.',
      data: reportResult.rows[0],
    });
  } catch (err) {
    console.error('submitReport error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit abuse report.' });
  }
};
