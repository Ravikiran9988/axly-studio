import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { query } from '../db/pool.js';
import { config } from '../config/env.js';
import { validateSafeDestinationUrl } from '../utils/ssrf.js';

const RESERVED_SLUGS = new Set([
  'api', 'admin', 'app', 'login', 'register', 'settings', 'profile', 'links',
  'analytics', 'campaigns', 'experiments', 'teams', 'developer', 'bulk',
  'domains', 'pages', 'assets', 'static', 'robots', 'sitemap', 'privacy',
  'terms', 'pricing', 'help', 'support', 'status', 'favicon', 'p', 's',
]);

const VALID_TEMPLATES = new Set(['minimal', 'creator', 'developer', 'business', 'business-card']);
const VALID_PAGE_TYPES = new Set(['link-in-bio', 'business-card', 'portfolio', 'creator']);
const VALID_BLOCK_TYPES = new Set(['link', 'heading', 'text', 'social', 'image', 'video', 'divider', 'lead_form', 'file']);

export const publicLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many form submissions. Please try again later.' },
});

const safeText = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeUrl = (value, optional = true) => {
  if (!value && optional) return null;
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
    const safeDestination = validateSafeDestinationUrl(parsed.toString());
    if (!safeDestination.valid) return null;
    return safeDestination.url;
  } catch {
    return null;
  }
};

export const normalizePageSlug = (value) => {
  const slug = safeText(value, 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/.test(slug)) {
    return { valid: false, message: 'Page URL must be 3–64 characters and contain only letters, numbers and interior hyphens.' };
  }
  if (RESERVED_SLUGS.has(slug)) return { valid: false, message: 'That page URL is reserved. Choose another slug.' };
  return { valid: true, slug };
};

export const sanitizePageBlocks = (input) => {
  if (!Array.isArray(input)) return { valid: false, message: 'Blocks must be a list.' };
  if (input.length > 40) return { valid: false, message: 'A page can contain at most 40 blocks.' };

  const blocks = [];
  const ids = new Set();
  for (let index = 0; index < input.length; index++) {
    const raw = input[index] || {};
    if (!VALID_BLOCK_TYPES.has(raw.type)) return { valid: false, message: `Block ${index + 1} has an unsupported type.` };

    let id = safeText(raw.id, 100).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) id = `block-${index + 1}`;
    if (ids.has(id)) return { valid: false, message: 'Each block must have a unique ID.' };
    ids.add(id);

    const visible = raw.visible !== false;
    const block = { id, type: raw.type, visible };
    if (raw.type === 'link' || raw.type === 'social' || raw.type === 'file') {
      const label = safeText(raw.label, 120);
      const url = safeUrl(raw.url, false);
      if (!label || !url) return { valid: false, message: `Block ${index + 1} needs a label and a valid HTTP(S) URL.` };
      block.label = label;
      block.url = url;
      if (raw.type === 'link') {
        block.description = safeText(raw.description, 240);
        block.icon = safeText(raw.icon, 40);
        block.featured = raw.featured === true;
      }
      if (raw.type === 'social') block.platform = safeText(raw.platform, 40) || 'website';
    } else if (raw.type === 'heading' || raw.type === 'text') {
      block.text = safeText(raw.text, raw.type === 'heading' ? 180 : 1600);
      if (!block.text) return { valid: false, message: `Block ${index + 1} needs text content.` };
    } else if (raw.type === 'image') {
      const url = safeUrl(raw.url, false);
      if (!url) return { valid: false, message: `Image block ${index + 1} needs a valid HTTP(S) image URL.` };
      block.url = url;
      block.alt = safeText(raw.alt, 180);
      block.caption = safeText(raw.caption, 240);
    } else if (raw.type === 'video') {
      const url = safeUrl(raw.url, false);
      if (!url) return { valid: false, message: `Video block ${index + 1} needs a valid HTTP(S) URL.` };
      try {
        const parsed = new URL(url);
        if (!['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(parsed.hostname.toLowerCase())) {
          return { valid: false, message: 'Video embeds are limited to YouTube and Vimeo URLs.' };
        }
      } catch {
        return { valid: false, message: `Video block ${index + 1} URL is invalid.` };
      }
      block.url = url;
      block.title = safeText(raw.title, 180);
    } else if (raw.type === 'lead_form') {
      block.title = safeText(raw.title, 120) || 'Get in touch';
      block.description = safeText(raw.description, 240);
      block.buttonLabel = safeText(raw.buttonLabel, 40) || 'Send message';
    } else if (raw.type === 'divider') {
      block.style = ['line', 'space'].includes(raw.style) ? raw.style : 'line';
    }
    blocks.push(block);
  }
  return { valid: true, blocks };
};

const sanitizeTheme = (raw = {}) => {
  const theme = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  return {
    mode: theme.mode === 'dark' ? 'dark' : 'light',
    accent: color(theme.accent, '#2563eb'),
    background: color(theme.background, theme.mode === 'dark' ? '#111827' : '#f8fafc'),
    buttonStyle: ['rounded', 'pill', 'square'].includes(theme.buttonStyle) ? theme.buttonStyle : 'rounded',
    font: ['inter', 'space-grotesk', 'system'].includes(theme.font) ? theme.font : 'inter',
    layout: ['centered', 'left'].includes(theme.layout) ? theme.layout : 'centered',
  };
};

const pageInput = (body, current = {}) => {
  const result = { ...current };
  if ('slug' in body) {
    const parsed = normalizePageSlug(body.slug);
    if (!parsed.valid) return { valid: false, message: parsed.message };
    result.slug = parsed.slug;
  }
  if ('title' in body) {
    result.title = safeText(body.title, 160);
    if (result.title.length < 1) return { valid: false, message: 'Page title is required.' };
  }
  if ('bio' in body) result.bio = safeText(body.bio, 600);
  if ('profileImageUrl' in body || 'profile_image_url' in body) {
    const value = body.profileImageUrl ?? body.profile_image_url;
    const parsed = value ? safeUrl(value, false) : null;
    if (value && !parsed) return { valid: false, message: 'Profile image must use a valid HTTP(S) URL.' };
    result.profile_image_url = parsed;
  }
  if ('pageType' in body || 'page_type' in body) {
    const value = body.pageType ?? body.page_type;
    if (!VALID_PAGE_TYPES.has(value)) return { valid: false, message: 'Unsupported page type.' };
    result.page_type = value;
  }
  if ('templateKey' in body || 'template_key' in body) {
    const value = body.templateKey ?? body.template_key;
    if (!VALID_TEMPLATES.has(value)) return { valid: false, message: 'Unsupported page template.' };
    result.template_key = value;
  }
  if ('theme' in body) result.theme = sanitizeTheme(body.theme);
  if ('blocks' in body) {
    const parsed = sanitizePageBlocks(body.blocks);
    if (!parsed.valid) return parsed;
    result.blocks = parsed.blocks;
  }
  const textFields = {
    seoTitle: ['seo_title', 180],
    seoDescription: ['seo_description', 320],
    ogImageUrl: ['og_image_url', 2048],
    contactEmail: ['contact_email', 320],
    contactPhone: ['contact_phone', 80],
    contactCompany: ['contact_company', 160],
    contactJobTitle: ['contact_job_title', 160],
  };
  for (const [inputKey, [dbKey, max]] of Object.entries(textFields)) {
    if (inputKey in body || dbKey in body) {
      const value = body[inputKey] ?? body[dbKey];
      if (inputKey === 'ogImageUrl' && value) {
        const parsed = safeUrl(value, false);
        if (!parsed) return { valid: false, message: 'Social sharing image must use a valid HTTP(S) URL.' };
        result[dbKey] = parsed;
      } else if (inputKey === 'contactEmail' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, message: 'Contact email is invalid.' };
      } else {
        result[dbKey] = safeText(value, max) || null;
      }
    }
  }
  for (const [key, dbKey] of [['publishAt', 'publish_at'], ['unpublishAt', 'unpublish_at']]) {
    if (key in body || dbKey in body) {
      const raw = body[key] ?? body[dbKey];
      if (raw === null || raw === '') {
        result[dbKey] = null;
      } else {
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) return { valid: false, message: `${key} must be a valid date.` };
        result[dbKey] = date.toISOString();
      }
    }
  }
  if ('status' in body) {
    if (!['draft', 'published', 'archived'].includes(body.status)) return { valid: false, message: 'Status must be draft, published, or archived.' };
    result.status = body.status;
  }
  if ('customDomainId' in body || 'custom_domain_id' in body) {
    result.custom_domain_id = body.customDomainId ?? body.custom_domain_id ?? null;
  }
  return { valid: true, value: result };
};

const publicColumns = `
  id, slug, title, bio, profile_image_url, page_type, template_key, theme, blocks,
  seo_title, seo_description, og_image_url, publish_at, unpublish_at,
  contact_email, contact_phone, contact_company, contact_job_title, created_at, updated_at, published_at
`;

const getPublishedBySlug = async (slug) => {
  const result = await query(
    `SELECT ${publicColumns}
     FROM public_pages
     WHERE LOWER(slug) = LOWER($1) AND status = 'published'
       AND (publish_at IS NULL OR publish_at <= NOW())
       AND (unpublish_at IS NULL OR unpublish_at > NOW())
     LIMIT 1`,
    [slug]
  );
  return result.rows[0] || null;
};

const hashVisitor = (req, pageId) => crypto
  .createHmac('sha256', config.visitorSalt)
  .update(`${pageId}:${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.headers['user-agent'] || ''}`)
  .digest('hex');

const getUserQuota = async (userId) => {
  const result = await query('SELECT plan FROM users WHERE id = $1', [userId]);
  return countPageQuota(result.rows[0]?.plan || 'free');
};

const getOwnedPage = async (id, userId) => {
  const result = await query('SELECT * FROM public_pages WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rows[0] || null;
};

const countPageQuota = (plan) => {
  const normalized = String(plan || 'free').toLowerCase();
  if (['enterprise', 'unlimited'].includes(normalized)) return { pages: 100, blocks: 40 };
  if (['pro', 'business', 'team'].includes(normalized)) return { pages: 25, blocks: 40 };
  return { pages: 3, blocks: 25 };
};

export const listPages = async (req, res) => {
  try {
    const result = await query(`
      SELECT p.id, p.slug, p.title, p.bio, p.profile_image_url, p.page_type, p.template_key,
             p.status, p.publish_at, p.unpublish_at, p.custom_domain_id, p.created_at, p.updated_at,
             p.published_at, d.domain AS custom_domain, d.status AS domain_status,
             COALESCE(e.views, 0)::bigint AS views, COALESCE(e.clicks, 0)::bigint AS clicks
      FROM public_pages p
      LEFT JOIN custom_domains d ON d.id = p.custom_domain_id
      LEFT JOIN (
        SELECT page_id,
          COUNT(*) FILTER (WHERE event_type = 'page_view') AS views,
          COUNT(*) FILTER (WHERE event_type = 'link_click') AS clicks
        FROM page_events GROUP BY page_id
      ) e ON e.page_id = p.id
      WHERE p.user_id = $1
      ORDER BY p.updated_at DESC
    `, [req.user.id]);
    const quota = await getUserQuota(req.user.id);
    res.json({ success: true, data: result.rows, quota });
  } catch (err) {
    if (err.code === '42P01') {
      console.warn('public_pages table not yet migrated, returning empty list');
      return res.json({ success: true, data: [], quota: { pages: 3, blocks: 25 } });
    }
    console.error('listPages error:', err);
    res.status(500).json({ success: false, message: 'Failed to load pages.' });
  }
};

export const createPage = async (req, res) => {
  try {
    const input = pageInput(req.body || {});
    if (!input.valid) return res.status(400).json({ success: false, message: input.message });
    const value = input.value;
    if (!value.slug || !value.title) return res.status(400).json({ success: false, message: 'Page title and URL slug are required.' });

    const quota = await getUserQuota(req.user.id);
    const count = await query('SELECT COUNT(*)::int AS count FROM public_pages WHERE user_id = $1', [req.user.id]);
    if (count.rows[0].count >= quota.pages) {
      return res.status(403).json({ success: false, code: 'PAGE_QUOTA_REACHED', message: `Your current plan allows ${quota.pages} pages. Upgrade your plan to create more.`, quota });
    }
    const parsedBlocks = sanitizePageBlocks(req.body.blocks || []);
    if (!parsedBlocks.valid) return res.status(400).json({ success: false, message: parsedBlocks.message });
    if (parsedBlocks.blocks.length > quota.blocks) return res.status(403).json({ success: false, message: `Your current plan allows up to ${quota.blocks} blocks per page.` });

    if (value.publish_at && value.unpublish_at && new Date(value.unpublish_at) <= new Date(value.publish_at)) {
      return res.status(400).json({ success: false, message: 'Unpublish date must be later than publish date.' });
    }

    const result = await query(`
      INSERT INTO public_pages (
        user_id, slug, title, bio, profile_image_url, page_type, template_key, theme, blocks,
        status, seo_title, seo_description, og_image_url, publish_at, unpublish_at,
        contact_email, contact_phone, contact_company, contact_job_title
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      ) RETURNING *
    `, [
      req.user.id, value.slug, value.title, value.bio || '', value.profile_image_url || null,
      value.page_type || 'link-in-bio', value.template_key || 'minimal',
      JSON.stringify(value.theme || sanitizeTheme({})), JSON.stringify(parsedBlocks.blocks),
      value.status || 'draft', value.seo_title || null, value.seo_description || null,
      value.og_image_url || null, value.publish_at || null, value.unpublish_at || null,
      value.contact_email || null, value.contact_phone || null, value.contact_company || null,
      value.contact_job_title || null,
    ]);
    res.status(201).json({ success: true, data: result.rows[0], quota, message: 'Page created.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'That public page URL is already in use.' });
    console.error('createPage error:', err);
    res.status(500).json({ success: false, message: 'Failed to create page.' });
  }
};

export const getPage = async (req, res) => {
  try {
    const page = await getOwnedPage(req.params.id, req.user.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    res.json({ success: true, data: page, quota: await getUserQuota(req.user.id) });
  } catch (err) {
    console.error('getPage error:', err);
    res.status(500).json({ success: false, message: 'Failed to load page.' });
  }
};

export const updatePage = async (req, res) => {
  try {
    const body = req.body || {};
    const current = await getOwnedPage(req.params.id, req.user.id);
    if (!current) return res.status(404).json({ success: false, message: 'Page not found.' });

    const input = pageInput(body, current);
    if (!input.valid) return res.status(400).json({ success: false, message: input.message });
    const value = input.value;
    const quota = await getUserQuota(req.user.id);
    if (Array.isArray(value.blocks) && value.blocks.length > quota.blocks) {
      return res.status(403).json({ success: false, message: `Your current plan allows up to ${quota.blocks} blocks per page.` });
    }
    if (value.publish_at && value.unpublish_at && new Date(value.unpublish_at) <= new Date(value.publish_at)) {
      return res.status(400).json({ success: false, message: 'Unpublish date must be later than publish date.' });
    }

    if (value.custom_domain_id) {
      const domain = await query(
        `SELECT id FROM custom_domains
         WHERE id = $1 AND user_id = $2 AND domain_type = 'page' AND status = 'active'`,
        [value.custom_domain_id, req.user.id]
      );
      if (domain.rows.length === 0) return res.status(400).json({ success: false, message: 'Choose a verified page domain owned by your account.' });
    }

    const keys = [
      'slug','title','bio','profile_image_url','page_type','template_key','theme','blocks','status',
      'seo_title','seo_description','og_image_url','publish_at','unpublish_at','contact_email',
      'contact_phone','contact_company','contact_job_title','custom_domain_id',
    ];
    const values = {
      slug:value.slug, title:value.title, bio:value.bio, profile_image_url:value.profile_image_url,
      page_type:value.page_type, template_key:value.template_key, theme:value.theme, blocks:value.blocks,
      status:value.status, seo_title:value.seo_title, seo_description:value.seo_description, og_image_url:value.og_image_url,
      publish_at:value.publish_at, unpublish_at:value.unpublish_at, contact_email:value.contact_email,
      contact_phone:value.contact_phone, contact_company:value.contact_company, contact_job_title:value.contact_job_title,
      custom_domain_id:value.custom_domain_id,
    };
    const set = [];
    const params = [];
    for (const key of keys) {
      const aliases = {
        profile_image_url:'profileImageUrl', page_type:'pageType', template_key:'templateKey',
        seo_title:'seoTitle', seo_description:'seoDescription', og_image_url:'ogImageUrl',
        publish_at:'publishAt', unpublish_at:'unpublishAt', contact_email:'contactEmail',
        contact_phone:'contactPhone', contact_company:'contactCompany', contact_job_title:'contactJobTitle',
        custom_domain_id:'customDomainId',
      };
      if (key in body || (aliases[key] && aliases[key] in body)) {
        let fieldValue = values[key];
        if (key === 'theme' || key === 'blocks') fieldValue = JSON.stringify(fieldValue);
        params.push(fieldValue ?? null);
        set.push(`${key} = $${params.length}${key === 'theme' || key === 'blocks' ? '::jsonb' : ''}`);
      }
    }
    if (set.length === 0) return res.json({ success: true, data: current, message: 'No changes to save.' });
    set.push('updated_at = NOW()');
    if (value.status === 'published' && current.status !== 'published') set.push('published_at = NOW()');
    params.push(req.params.id, req.user.id);
    await query(
      'INSERT INTO page_revisions (page_id, user_id, revision_label, snapshot) VALUES ($1, $2, $3, $4::jsonb)',
      [current.id, req.user.id, safeText(body.revisionLabel, 160) || 'Before update', JSON.stringify(current)]
    );
    const saved = await query(
      `UPDATE public_pages SET ${set.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length} RETURNING *`,
      params
    );
    res.json({ success: true, data: saved.rows[0], message: 'Page saved.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'That public page URL is already in use.' });
    console.error('updatePage error:', err);
    res.status(500).json({ success: false, message: 'Failed to save page.' });
  }
};

export const duplicatePage = async (req, res) => {
  try {
    const source = await getOwnedPage(req.params.id, req.user.id);
    if (!source) return res.status(404).json({ success: false, message: 'Page not found.' });
    const quota = await getUserQuota(req.user.id);
    const count = await query('SELECT COUNT(*)::int AS count FROM public_pages WHERE user_id = $1', [req.user.id]);
    if (count.rows[0].count >= quota.pages) return res.status(403).json({ success: false, message: 'Page limit reached for your current plan.' });

    const rootSlug = `${source.slug.slice(0, 50)}-copy`;
    let slug = rootSlug;
    for (let n = 2; n < 20; n++) {
      const exists = await query('SELECT id FROM public_pages WHERE LOWER(slug) = LOWER($1)', [slug]);
      if (exists.rows.length === 0) break;
      slug = `${rootSlug.slice(0, 57)}-${n}`;
    }
    const created = await query(`
      INSERT INTO public_pages (
        user_id, slug, title, bio, profile_image_url, page_type, template_key, theme, blocks,
        status, seo_title, seo_description, og_image_url, contact_email, contact_phone, contact_company, contact_job_title
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      req.user.id, slug, `${source.title} (Copy)`, source.bio, source.profile_image_url,
      source.page_type, source.template_key, JSON.stringify(source.theme), JSON.stringify(source.blocks),
      source.seo_title, source.seo_description, source.og_image_url, source.contact_email,
      source.contact_phone, source.contact_company, source.contact_job_title,
    ]);
    res.status(201).json({ success: true, data: created.rows[0], message: 'Draft copy created.' });
  } catch (err) {
    console.error('duplicatePage error:', err);
    res.status(500).json({ success: false, message: 'Failed to duplicate page.' });
  }
};

export const deletePage = async (req, res) => {
  try {
    const result = await query('DELETE FROM public_pages WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Page not found.' });
    res.json({ success: true, message: 'Page deleted.' });
  } catch (err) {
    console.error('deletePage error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete page.' });
  }
};

export const getPublicPageBySlug = async (req, res) => {
  try {
    const slug = safeText(req.params.slug, 64).toLowerCase();
    const page = await getPublishedBySlug(slug);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found or not published.' });
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json({ success: true, data: page });
  } catch (err) {
    console.error('getPublicPageBySlug error:', err);
    res.status(500).json({ success: false, message: 'Failed to load public page.' });
  }
};

export const getPublicPageByDomain = async (req, res) => {
  try {
    const host = safeText(req.query.host, 253).toLowerCase().replace(/:\d+$/, '');
    if (!host || !/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) {
      return res.status(400).json({ success: false, message: 'A valid hostname is required.' });
    }
    const result = await query(`
      SELECT p.id, p.slug, p.title, p.bio, p.profile_image_url, p.page_type, p.template_key,
             p.theme, p.blocks, p.seo_title, p.seo_description, p.og_image_url,
             p.contact_email, p.contact_phone, p.contact_company, p.contact_job_title, p.created_at
      FROM public_pages p
      JOIN custom_domains d ON d.id = p.custom_domain_id
      WHERE LOWER(d.domain) = $1 AND d.domain_type = 'page' AND d.status = 'active'
        AND p.status = 'published' AND (p.publish_at IS NULL OR p.publish_at <= NOW())
        AND (p.unpublish_at IS NULL OR p.unpublish_at > NOW())
      LIMIT 1
    `, [host]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'No published Axly page is connected to this domain.' });
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('getPublicPageByDomain error:', err);
    res.status(500).json({ success: false, message: 'Failed to resolve custom domain.' });
  }
};

export const recordPublicPageEvent = async (req, res) => {
  try {
    const page = await getPublishedBySlug(safeText(req.params.slug, 64).toLowerCase());
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const eventType = req.body?.eventType;
    if (!['page_view', 'link_click'].includes(eventType)) return res.status(400).json({ success: false, message: 'Invalid page event.' });

    let blockId = null;
    if (eventType === 'link_click') {
      blockId = safeText(req.body?.blockId, 100);
      const block = (Array.isArray(page.blocks) ? page.blocks : []).find(item => item.id === blockId && item.visible !== false && ['link','social','file'].includes(item.type));
      if (!block) return res.status(400).json({ success: false, message: 'Unknown page link.' });
    }
    const referrer = safeText(req.get('referer') || '', 1024);
    let referrerHost = null;
    try { referrerHost = referrer ? new URL(referrer).hostname.slice(0,255) : null; } catch {}
    const visitorHash = hashVisitor(req, page.id);
    const deviceType = /tablet/i.test(req.get('user-agent') || '') ? 'tablet' : /mobile|android|iphone/i.test(req.get('user-agent') || '') ? 'mobile' : 'desktop';

    await query(
      'INSERT INTO page_events (page_id, event_type, block_id, visitor_hash, referrer_host, device_type) VALUES ($1,$2,$3,$4,$5,$6)',
      [page.id, eventType, blockId, visitorHash, referrerHost, deviceType]
    );
    res.status(202).json({ success: true });
  } catch (err) {
    console.error('recordPublicPageEvent error:', err);
    res.status(500).json({ success: false, message: 'Failed to record page event.' });
  }
};

export const submitPageLead = async (req, res) => {
  try {
    const page = await getPublishedBySlug(safeText(req.params.slug, 64).toLowerCase());
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const hasLeadForm = (Array.isArray(page.blocks) ? page.blocks : []).some(block => block.type === 'lead_form' && block.visible !== false);
    if (!hasLeadForm) return res.status(404).json({ success: false, message: 'Lead capture is not enabled for this page.' });

    const name = safeText(req.body?.name, 120);
    const email = safeText(req.body?.email, 320).toLowerCase();
    const message = safeText(req.body?.message, 2000);
    const consent = req.body?.consent === true;
    if (name.length < 2) return res.status(400).json({ success: false, message: 'Enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    if (!consent) return res.status(400).json({ success: false, message: 'Consent is required before sending your message.' });

    await query(
      'INSERT INTO page_leads (page_id, name, email, message, consent, visitor_hash) VALUES ($1,$2,$3,$4,$5,$6)',
      [page.id, name, email, message || null, consent, hashVisitor(req, page.id)]
    );

    // Email notifications are optional and only sent when a server-side Resend key/from address is configured.
    if (process.env.RESEND_API_KEY && process.env.LEAD_NOTIFICATION_FROM) {
      try {
        const owner = await query(
          'SELECT u.email, u.name, p.title FROM public_pages p JOIN users u ON u.id = p.user_id WHERE p.id = $1',
          [page.id]
        );
        if (owner.rows[0]?.email) {
          const mailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.RESEND_API_KEY },
            body: JSON.stringify({
              from: process.env.LEAD_NOTIFICATION_FROM,
              to: [owner.rows[0].email],
              subject: 'New message for ' + (owner.rows[0].title || page.title),
              text: 'You received a new public-page message.\nName: ' + name + '\nEmail: ' + email + '\nMessage: ' + (message || '(none)') + '\n\nReview submissions in your Axly Studio page dashboard.',
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (!mailResponse.ok) console.error('Lead notification provider returned status', mailResponse.status);
        }
      } catch (mailError) {
        // Do not discard a saved lead when email delivery is temporarily unavailable.
        console.error('Lead notification email failed:', mailError.message);
      }
    }
    res.status(201).json({ success: true, message: 'Thanks — your message has been received. The page owner can review it in Axly Studio.' });
  } catch (err) {
    console.error('submitPageLead error:', err);
    res.status(500).json({ success: false, message: 'Could not submit your message.' });
  }
};

export const getPageAnalytics = async (req, res) => {
  try {
    const page = await getOwnedPage(req.params.id, req.user.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const [totals, daily, topLinks, referrers, devices, leads] = await Promise.all([
      query(`SELECT COUNT(*) FILTER (WHERE event_type='page_view')::int AS views,
                    COUNT(DISTINCT visitor_hash) FILTER (WHERE event_type='page_view')::int AS unique_visitors,
                    COUNT(*) FILTER (WHERE event_type='link_click')::int AS clicks
             FROM page_events WHERE page_id=$1`, [page.id]),
      query(`SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                    COUNT(*) FILTER (WHERE event_type='page_view')::int AS views,
                    COUNT(*) FILTER (WHERE event_type='link_click')::int AS clicks
             FROM page_events WHERE page_id=$1 AND created_at >= NOW() - INTERVAL '30 days'
             GROUP BY DATE_TRUNC('day', created_at) ORDER BY DATE_TRUNC('day', created_at)`, [page.id]),
      query(`SELECT block_id, COUNT(*)::int AS clicks FROM page_events
             WHERE page_id=$1 AND event_type='link_click' GROUP BY block_id ORDER BY clicks DESC LIMIT 10`, [page.id]),
      query(`SELECT COALESCE(referrer_host, 'Direct / Unknown') AS source, COUNT(*)::int AS views
             FROM page_events WHERE page_id=$1 AND event_type='page_view'
             GROUP BY COALESCE(referrer_host, 'Direct / Unknown') ORDER BY views DESC LIMIT 8`, [page.id]),
      query(`SELECT COALESCE(device_type, 'Unknown') AS device, COUNT(*)::int AS views
             FROM page_events WHERE page_id=$1 AND event_type='page_view'
             GROUP BY COALESCE(device_type, 'Unknown') ORDER BY views DESC`, [page.id]),
      query('SELECT COUNT(*)::int AS count FROM page_leads WHERE page_id=$1', [page.id]),
    ]);
    const blockLabels = new Map((Array.isArray(page.blocks) ? page.blocks : []).map(block => [block.id, block.label || block.text || block.title || block.type]));
    res.json({
      success: true,
      data: {
        totals: { ...totals.rows[0], leads: leads.rows[0].count },
        daily: daily.rows,
        topLinks: topLinks.rows.map(row => ({ ...row, label: blockLabels.get(row.block_id) || 'Removed link' })),
        referrers: referrers.rows,
        devices: devices.rows,
      },
    });
  } catch (err) {
    console.error('getPageAnalytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to load page analytics.' });
  }
};

export const listPageLeads = async (req, res) => {
  try {
    const page = await getOwnedPage(req.params.id, req.user.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const result = await query(
      'SELECT id, name, email, message, consent, created_at FROM page_leads WHERE page_id=$1 ORDER BY created_at DESC LIMIT 500',
      [page.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listPageLeads error:', err);
    res.status(500).json({ success: false, message: 'Failed to load captured leads.' });
  }
};

export const suggestPageCopy = async (req, res) => {
  const endpoint = process.env.AI_COPY_API_URL;
  const apiKey = process.env.AI_COPY_API_KEY;
  const model = process.env.AI_COPY_MODEL || 'gpt-4o-mini';
  if (!endpoint || !apiKey) {
    return res.status(503).json({ success: false, code: 'AI_NOT_CONFIGURED', message: 'AI copy suggestions are optional. Configure AI_COPY_API_URL, AI_COPY_API_KEY and AI_COPY_MODEL on the backend to enable this feature.' });
  }

  try {
    const parsedEndpoint = new URL(endpoint);
    if (process.env.NODE_ENV === 'production' && parsedEndpoint.protocol !== 'https:') {
      return res.status(503).json({ success: false, message: 'The configured AI endpoint must use HTTPS in production.' });
    }
    const page = await getOwnedPage(req.params.id, req.user.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const topic = safeText(req.body?.topic, 300) || page.title;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Write concise, professional, truthful website copy. Do not include HTML. Return a JSON object with title, bio, seoTitle, and seoDescription strings.' },
          { role: 'user', content: JSON.stringify({ topic, currentTitle: page.title, currentBio: page.bio, pageType: page.page_type }) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'The configured AI copy provider returned an error.' });
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') return res.status(502).json({ success: false, message: 'The AI provider returned no page copy.' });
    let suggestions;
    try { suggestions = JSON.parse(text); } catch { return res.status(502).json({ success: false, message: 'The AI provider returned invalid structured copy.' }); }
    res.json({
      success: true,
      data: {
        title: safeText(suggestions.title, 160),
        bio: safeText(suggestions.bio, 600),
        seoTitle: safeText(suggestions.seoTitle, 180),
        seoDescription: safeText(suggestions.seoDescription, 320),
      },
      message: 'Review the suggestions before applying them.',
    });
  } catch (err) {
    console.error('suggestPageCopy error:', err.message);
    res.status(502).json({ success: false, message: 'Unable to generate page copy right now.' });
  }
};

export const pageTemplates = (_req, res) => {
  res.json({
    success: true,
    data: [
      { key: 'minimal', name: 'Minimal', description: 'Clean profile and essential links.' },
      { key: 'creator', name: 'Creator', description: 'Social links, featured content and creator bio.' },
      { key: 'developer', name: 'Developer Portfolio', description: 'Projects, portfolio, GitHub and professional profiles.' },
      { key: 'business', name: 'Business', description: 'Company identity, contact details and lead capture.' },
      { key: 'business-card', name: 'Digital Business Card', description: 'Contact information and a downloadable vCard.' },
    ],
  });
};

export const listPageRevisions = async (req, res) => {
  try {
    const page = await getOwnedPage(req.params.id, req.user.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found.' });
    const result = await query(
      'SELECT id, revision_label, created_at FROM page_revisions WHERE page_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50',
      [page.id, req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listPageRevisions error:', err);
    res.status(500).json({ success: false, message: 'Could not load page history.' });
  }
};

export const restorePageRevision = async (req, res) => {
  try {
    const current = await getOwnedPage(req.params.id, req.user.id);
    if (!current) return res.status(404).json({ success: false, message: 'Page not found.' });
    const revisionResult = await query(
      'SELECT snapshot FROM page_revisions WHERE id = $1 AND page_id = $2 AND user_id = $3',
      [req.params.revisionId, current.id, req.user.id]
    );
    if (revisionResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Revision not found.' });

    const snapshot = revisionResult.rows[0].snapshot;
    const input = pageInput(snapshot, current);
    if (!input.valid) return res.status(400).json({ success: false, message: input.message });
    const value = input.value;
    if (value.custom_domain_id) {
      const domain = await query(
        "SELECT id FROM custom_domains WHERE id = $1 AND user_id = $2 AND domain_type = 'page' AND status = 'active'",
        [value.custom_domain_id, req.user.id]
      );
      if (domain.rows.length === 0) value.custom_domain_id = null;
    }

    await query(
      "INSERT INTO page_revisions (page_id, user_id, revision_label, snapshot) VALUES ($1, $2, 'Before restore', $3::jsonb)",
      [current.id, req.user.id, JSON.stringify(current)]
    );
    const result = await query(`
      UPDATE public_pages SET
        slug=$1, title=$2, bio=$3, profile_image_url=$4, page_type=$5, template_key=$6,
        theme=$7::jsonb, blocks=$8::jsonb, status=$9, seo_title=$10, seo_description=$11,
        og_image_url=$12, publish_at=$13, unpublish_at=$14, custom_domain_id=$15,
        contact_email=$16, contact_phone=$17, contact_company=$18, contact_job_title=$19,
        updated_at=NOW()
      WHERE id=$20 AND user_id=$21
      RETURNING *
    `, [
      value.slug, value.title, value.bio || '', value.profile_image_url || null,
      value.page_type || 'link-in-bio', value.template_key || 'minimal',
      JSON.stringify(sanitizeTheme(value.theme)), JSON.stringify(sanitizePageBlocks(value.blocks || []).blocks),
      value.status || 'draft', value.seo_title || null, value.seo_description || null,
      value.og_image_url || null, value.publish_at || null, value.unpublish_at || null,
      value.custom_domain_id || null, value.contact_email || null, value.contact_phone || null,
      value.contact_company || null, value.contact_job_title || null, current.id, req.user.id,
    ]);
    res.json({ success: true, data: result.rows[0], message: 'Page revision restored.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'This revision uses a page URL that is already taken.' });
    console.error('restorePageRevision error:', err);
    res.status(500).json({ success: false, message: 'Could not restore that revision.' });
  }
};

