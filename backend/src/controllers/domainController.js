import crypto from 'crypto';
import { query } from '../db/pool.js';
import { validateDomainSyntax, verifyDomainDns } from '../utils/dnsVerifier.js';
import { logAuditEvent } from '../utils/audit.js';

/**
 * GET /api/domains - List registered custom domains
 */
export const listDomains = async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId || null;

    let result;
    if (workspaceId) {
      result = await query(`
        SELECT id, domain, domain_type, verification_token, status, dns_record_type, dns_expected_value, verified_at, ssl_status, created_at
        FROM custom_domains
        WHERE workspace_id = $1 AND (user_id = $2 OR $3 = 'admin')
        ORDER BY created_at DESC
      `, [workspaceId, req.user.id, req.user.role]);
    } else {
      result = await query(`
        SELECT id, domain, domain_type, verification_token, status, dns_record_type, dns_expected_value, verified_at, ssl_status, created_at
        FROM custom_domains
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [req.user.id]);
    }

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('listDomains error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve custom domains.' });
  }
};

/**
 * POST /api/domains - Register a custom branded domain
 */
export const createDomain = async (req, res) => {
  try {
    const { domain, workspaceId = null, domainType = 'shortlinks' } = req.body;
    if (!['shortlinks', 'page'].includes(domainType)) return res.status(400).json({ success: false, message: 'Domain type must be shortlinks or page.' });

    const validation = validateDomainSyntax(domain);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.reason });
    }

    const cleanDomain = validation.domain;

    // Workspace domains can route traffic for every short link in that workspace.
    // Restrict attachment to workspace owners/admins to prevent cross-tenant domain takeover.
    if (workspaceId && req.user.role !== 'admin') {
      const membership = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, req.user.id]
      );
      if (!membership.rows.some(row => ['owner', 'admin'].includes(row.role))) {
        return res.status(403).json({
          success: false,
          message: 'Workspace owner or admin membership is required to register a workspace domain.',
        });
      }
    }

    // Check duplicate
    const existing = await query('SELECT id, status FROM custom_domains WHERE domain = $1', [cleanDomain]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This domain is already registered on the platform.',
      });
    }

    const verificationToken = `axly-verify-${crypto.randomBytes(12).toString('hex')}`;
    const dnsExpectedValue = domainType === 'page' ? 'url.axly.in' : 'api.axly.in';

    const result = await query(`
      INSERT INTO custom_domains (
        user_id, workspace_id, domain, domain_type, verification_token, status, dns_record_type, dns_expected_value
      ) VALUES ($1, $2, $3, $4, $5, 'pending_dns', 'CNAME', $6)
      RETURNING id, domain, domain_type, verification_token, status, dns_record_type, dns_expected_value, created_at
    `, [req.user.id, workspaceId || null, cleanDomain, domainType, verificationToken, dnsExpectedValue]);

    const created = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'domain.create',
      targetType: 'custom_domain',
      targetId: created.id,
      details: { domain: cleanDomain },
      ip: req.ip,
    });

    const domainData = {
      ...created,
      instructions: {
        primaryMethod: {
          type: 'CNAME',
          host: cleanDomain,
          target: dnsExpectedValue,
        },
        ownershipTxtRecord: {
          purpose: 'Optional ownership evidence; traffic routing still requires the CNAME above.',
          type: 'TXT',
          host: `_axly-verify.${cleanDomain}`,
          value: verificationToken,
        },
      },
    };

    res.status(201).json({
      success: true,
      message: 'Custom domain registered. Configure DNS records to complete verification.',
      data: domainData,
      domain: domainData,
    });
  } catch (err) {
    console.error('createDomain error:', err);
    res.status(500).json({ success: false, message: 'Failed to register custom domain.' });
  }
};

/**
 * POST /api/domains/:id/verify - Probe DNS records to verify ownership
 */
export const verifyDomain = async (req, res) => {
  try {
    const { id } = req.params;

    const domRes = await query(`
      SELECT id, domain, domain_type, verification_token, status, dns_expected_value
      FROM custom_domains
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
    `, [id, req.user.id, req.user.role]);

    if (domRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Custom domain not found.' });
    }

    const domainRecord = domRes.rows[0];

    // Check DNS records
    const check = await verifyDomainDns(domainRecord.domain, domainRecord.verification_token, domainRecord.dns_expected_value);

    if (!check.verified) {
      return res.status(400).json({
        success: false,
        message: 'DNS verification failed.',
        reason: check.reason,
      });
    }

    // Update status to active & verified
    const updated = await query(`
      UPDATE custom_domains
      SET status = 'active', verified_at = NOW(), ssl_status = 'pending', updated_at = NOW()
      WHERE id = $1
      RETURNING id, domain, status, verified_at, ssl_status
    `, [id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'domain.verify',
      targetType: 'custom_domain',
      targetId: id,
      details: { domain: domainRecord.domain, method: check.method },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `DNS routing for '${domainRecord.domain}' is verified. HTTPS becomes active after the hosting provider finishes domain setup and provisions a certificate.`,
      data: updated.rows[0],
    });
  } catch (err) {
    console.error('verifyDomain error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify custom domain.' });
  }
};

/**
 * DELETE /api/domains/:id - Remove custom domain
 */
export const deleteDomain = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM custom_domains
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
      RETURNING id, domain
    `, [id, req.user.id, req.user.role]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Custom domain not found.' });
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'domain.delete',
      targetType: 'custom_domain',
      targetId: id,
      details: { domain: result.rows[0].domain },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Domain '${result.rows[0].domain}' removed successfully.`,
    });
  } catch (err) {
    console.error('deleteDomain error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete domain.' });
  }
};
