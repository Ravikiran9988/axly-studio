import pool, { query } from '../db/pool.js';
import { validateSafeDestinationUrl } from '../utils/ssrf.js';

// GET /api/experiments - List experiments for authenticated user
export const getExperiments = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        e.id, e.name, e.status, e.start_time, e.end_time, e.conversion_goal, e.created_at, e.updated_at,
        u.id as url_id, u.short_code, u.original_url,
        COALESCE(SUM(ev.clicks), 0)::bigint as total_experiment_clicks,
        COALESCE(SUM(ev.conversions), 0)::bigint as total_conversions,
        COUNT(ev.id)::int as variant_count
      FROM experiments e
      JOIN urls u ON e.url_id = u.id
      LEFT JOIN experiment_variants ev ON e.id = ev.experiment_id
      WHERE e.user_id = $1
      GROUP BY e.id, u.id
      ORDER BY e.created_at DESC
    `, [userId]);

    const experiments = result.rows.map(exp => {
      const clicks = Number(exp.total_experiment_clicks);
      const convs = Number(exp.total_conversions);
      const cr = clicks > 0 ? Number(((convs / clicks) * 100).toFixed(2)) : 0;
      return {
        ...exp,
        total_clicks: clicks,
        total_conversions: convs,
        conversion_rate_pct: cr,
      };
    });

    res.json({ success: true, data: experiments });
  } catch (err) {
    console.error('getExperiments error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve experiments.' });
  }
};

// POST /api/experiments - Create experiment with variants
export const createExperiment = async (req, res) => {
  const userId = req.user.id;
  const { urlId, name, conversionGoal, startTime, endTime, variants } = req.body;

  if (!urlId || !name || !Array.isArray(variants) || variants.length < 2) {
    return res.status(400).json({ 
      success: false, 
      message: 'Experiment requires a valid URL, a name, and at least 2 destination variants.' 
    });
  }

  // Validate variants
  let totalWeight = 0;
  const validatedVariants = [];

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    if (!v.name || !v.destinationUrl) {
      return res.status(400).json({ success: false, message: `Variant ${i + 1} requires a name and destinationUrl.` });
    }

    const ssrfCheck = validateSafeDestinationUrl(v.destinationUrl);
    if (!ssrfCheck.valid) {
      return res.status(400).json({ success: false, message: `Variant ${i + 1} (${v.name}): ${ssrfCheck.error}` });
    }

    const weight = Math.max(1, Math.min(100, parseInt(v.weight, 10) || 50));
    totalWeight += weight;

    validatedVariants.push({
      name: String(v.name).trim().slice(0, 100),
      destinationUrl: ssrfCheck.url,
      weight,
    });
  }

  let client;
  try {
    client = await pool.connect();

    // Verify URL ownership
    const urlCheck = await client.query('SELECT id, original_url FROM urls WHERE id = $1 AND user_id = $2', [urlId, userId]);
    if (urlCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    await client.query('BEGIN');

    // Create experiment in active or draft state
    const expResult = await client.query(`
      INSERT INTO experiments (url_id, user_id, name, status, start_time, end_time, conversion_goal)
      VALUES ($1, $2, $3, 'active', $4, $5, $6)
      RETURNING *
    `, [
      urlId,
      userId,
      String(name).trim().slice(0, 255),
      startTime ? new Date(startTime) : null,
      endTime ? new Date(endTime) : null,
      conversionGoal ? String(conversionGoal).trim().slice(0, 255) : null,
    ]);

    const experiment = expResult.rows[0];

    // Insert variants
    const insertedVariants = [];
    for (const v of validatedVariants) {
      const vResult = await client.query(`
        INSERT INTO experiment_variants (experiment_id, name, destination_url, weight)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [experiment.id, v.name, v.destinationUrl, v.weight]);
      insertedVariants.push(vResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'A/B Experiment created and activated.',
      data: {
        ...experiment,
        variants: insertedVariants,
      }
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Ignore rollback error if client closed
      }
    }
    console.error('createExperiment error:', err);
    res.status(500).json({ success: false, message: 'Failed to create experiment.' });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// GET /api/experiments/:id - Get experiment details & variant analytics
export const getExperimentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const expResult = await query(`
      SELECT e.*, u.short_code, u.original_url 
      FROM experiments e
      JOIN urls u ON e.url_id = u.id
      WHERE e.id = $1 AND e.user_id = $2
    `, [id, userId]);

    if (expResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Experiment not found.' });
    }

    const experiment = expResult.rows[0];

    const variantsResult = await query(`
      SELECT id, name, destination_url, weight, clicks, conversions, created_at
      FROM experiment_variants
      WHERE experiment_id = $1
      ORDER BY id ASC
    `, [id]);

    const variants = variantsResult.rows.map(v => {
      const clicks = Number(v.clicks);
      const convs = Number(v.conversions);
      const rate = clicks > 0 ? Number(((convs / clicks) * 100).toFixed(2)) : 0;
      return {
        ...v,
        clicks,
        conversions: convs,
        conversion_rate_pct: rate,
      };
    });

    res.json({
      success: true,
      data: {
        ...experiment,
        variants,
      }
    });
  } catch (err) {
    console.error('getExperimentById error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve experiment details.' });
  }
};

// PATCH /api/experiments/:id - Update experiment
export const updateExperiment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, status, conversionGoal, startTime, endTime } = req.body;

    const check = await query('SELECT id FROM experiments WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Experiment not found.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      params.push(String(name).trim().slice(0, 255));
      updates.push(`name = $${params.length}`);
    }

    if (status !== undefined) {
      if (!['draft', 'active', 'paused', 'completed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be draft, active, paused, or completed.' });
      }
      params.push(status);
      updates.push(`status = $${params.length}`);
    }

    if (conversionGoal !== undefined) {
      params.push(conversionGoal ? String(conversionGoal).trim().slice(0, 255) : null);
      updates.push(`conversion_goal = $${params.length}`);
    }

    if (startTime !== undefined) {
      params.push(startTime ? new Date(startTime) : null);
      updates.push(`start_time = $${params.length}`);
    }

    if (endTime !== undefined) {
      params.push(endTime ? new Date(endTime) : null);
      updates.push(`end_time = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No changes provided.' });
    }

    updates.push('updated_at = NOW()');
    params.push(id, userId);

    const result = await query(`
      UPDATE experiments 
      SET ${updates.join(', ')} 
      WHERE id = $${params.length - 1} AND user_id = $${params.length} 
      RETURNING *
    `, params);

    res.json({ success: true, message: 'Experiment updated successfully.', data: result.rows[0] });
  } catch (err) {
    console.error('updateExperiment error:', err);
    res.status(500).json({ success: false, message: 'Failed to update experiment.' });
  }
};

// DELETE /api/experiments/:id - Delete experiment
export const deleteExperiment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      'DELETE FROM experiments WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Experiment not found.' });
    }

    res.json({ success: true, message: 'Experiment deleted successfully.' });
  } catch (err) {
    console.error('deleteExperiment error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete experiment.' });
  }
};

// POST /api/experiments/:id/convert - Record a verified conversion event
export const recordConversion = async (req, res) => {
  try {
    const { id: experimentId } = req.params;
    const { variantId, visitorHash, conversionValue } = req.body;

    if (!variantId) {
      return res.status(400).json({ success: false, message: 'variantId is required.' });
    }

    // Verify variant belongs to experiment
    const vCheck = await query(
      'SELECT id FROM experiment_variants WHERE id = $1 AND experiment_id = $2',
      [variantId, experimentId]
    );

    if (vCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Variant not found for this experiment.' });
    }

    // Record conversion event
    await query(`
      INSERT INTO conversion_events (experiment_id, variant_id, visitor_hash, conversion_value)
      VALUES ($1, $2, $3, $4)
    `, [experimentId, variantId, visitorHash || null, Number(conversionValue) || 1]);

    // Atomic increment on variant
    await query(`
      UPDATE experiment_variants SET conversions = conversions + 1 WHERE id = $1
    `, [variantId]);

    res.json({ success: true, message: 'Conversion recorded successfully.' });
  } catch (err) {
    console.error('recordConversion error:', err);
    res.status(500).json({ success: false, message: 'Failed to record conversion.' });
  }
};
