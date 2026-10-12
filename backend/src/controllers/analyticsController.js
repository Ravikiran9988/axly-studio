import { query } from '../db/pool.js';

// GET /api/analytics - Account-level aggregated link analytics
export const getAccountAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

    const since = new Date();
    since.setDate(since.getDate() - days);

    // 1. High-level summary metrics
    const summaryRes = await query(`
      SELECT 
        COUNT(DISTINCT u.id)::int as total_urls,
        COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END)::int as active_urls,
        COALESCE(COUNT(ce.id), 0)::bigint as total_clicks,
        COALESCE(COUNT(DISTINCT ce.visitor_hash), 0)::bigint as unique_visitors
      FROM urls u
      LEFT JOIN click_events ce ON u.id = ce.url_id AND ce.clicked_at >= $2
      WHERE u.user_id = $1
    `, [userId, since]);

    const summary = summaryRes.rows[0];

    // 2. Daily clicks and daily unique visitors (Atomic SQL aggregation)
    const dailyClicks = await query(`
      SELECT 
        DATE(ce.clicked_at) as date,
        COUNT(ce.id)::bigint as clicks,
        COUNT(DISTINCT ce.visitor_hash)::bigint as unique_visitors
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= $2
      GROUP BY DATE(ce.clicked_at)
      ORDER BY date ASC
    `, [userId, since]);

    // 3. Top referrers
    const byReferer = await query(`
      SELECT 
        COALESCE(NULLIF(ce.referer, ''), 'Direct / Unknown') as referer,
        COUNT(ce.id)::bigint as clicks
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= $2
      GROUP BY ce.referer
      ORDER BY clicks DESC
      LIMIT 10
    `, [userId, since]);

    // 4. Device breakdown
    const byDevice = await query(`
      SELECT 
        COALESCE(NULLIF(ce.device_type, ''), 'desktop') as device,
        COUNT(ce.id)::bigint as clicks
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= $2
      GROUP BY ce.device_type
      ORDER BY clicks DESC
    `, [userId, since]);

    // 5. Browser breakdown
    const byBrowser = await query(`
      SELECT 
        COALESCE(NULLIF(ce.browser, ''), 'Unknown') as browser,
        COUNT(ce.id)::bigint as clicks
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= $2
      GROUP BY ce.browser
      ORDER BY clicks DESC
      LIMIT 8
    `, [userId, since]);

    // 6. Operating System breakdown
    const byOs = await query(`
      SELECT 
        COALESCE(NULLIF(ce.os, ''), 'Unknown') as os,
        COUNT(ce.id)::bigint as clicks
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= $2
      GROUP BY ce.os
      ORDER BY clicks DESC
      LIMIT 8
    `, [userId, since]);

    // 7. Country breakdown (honestly reported)
    const byCountry = await query(`
      SELECT 
        COALESCE(NULLIF(ce.country, ''), 'Unknown') as country,
        COUNT(ce.id)::bigint as clicks
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= $2
      GROUP BY ce.country
      ORDER BY clicks DESC
      LIMIT 10
    `, [userId, since]);

    res.json({
      success: true,
      data: {
        summary: {
          totalUrls: summary.total_urls,
          activeUrls: summary.active_urls,
          totalClicks: Number(summary.total_clicks),
          uniqueVisitors: Number(summary.unique_visitors),
        },
        dailyClicks: dailyClicks.rows,
        byReferer: byReferer.rows,
        byDevice: byDevice.rows,
        byBrowser: byBrowser.rows,
        byOs: byOs.rows,
        byCountry: byCountry.rows,
      }
    });
  } catch (err) {
    console.error('getAccountAnalytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve account analytics.' });
  }
};

// GET /api/analytics/export/csv - Export traffic metrics to CSV
export const exportAnalyticsCsv = async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

    const since = new Date();
    since.setDate(since.getDate() - days);

    const dailyResult = await query(`
      SELECT 
        DATE(ce.clicked_at) as date,
        COUNT(ce.id)::bigint as clicks,
        COUNT(DISTINCT ce.visitor_hash)::bigint as unique_visitors
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= $2
      GROUP BY DATE(ce.clicked_at)
      ORDER BY date ASC
    `, [userId, since]);

    const rows = [
      ['Date', 'Clicks', 'Unique Visitors']
    ];

    for (const r of dailyResult.rows) {
      rows.push([
        new Date(r.date).toISOString().split('T')[0],
        r.clicks,
        r.unique_visitors,
      ]);
    }

    const csvContent = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-traffic-${days}d.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('exportAnalyticsCsv error:', err);
    res.status(500).json({ success: false, message: 'Failed to export analytics CSV.' });
  }
};
