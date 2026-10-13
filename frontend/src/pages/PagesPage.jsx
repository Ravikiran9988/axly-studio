import { useEffect, useState } from 'react';
import { api } from '../context/AuthContext';
import {
  PanelsTopLeft, Plus, Edit3, Trash2, Copy, ExternalLink, Eye,
  Globe, BarChart3, Users, LayoutTemplate, Save, ArrowLeft, ArrowUp, ArrowDown,
  Link2, Type, Image, Video, Minus, Mail, CalendarClock, Palette, Send, PenTool
} from 'lucide-react';
import toast from 'react-hot-toast';

const TEMPLATES = [
  { key: 'minimal', name: 'Minimal', summary: 'A clean personal link page', icon: Link2, pageType: 'link-in-bio' },
  { key: 'creator', name: 'Creator', summary: 'Socials and featured content', icon: LayoutTemplate, pageType: 'creator' },
  { key: 'developer', name: 'Developer portfolio', summary: 'Projects and professional profiles', icon: PanelsTopLeft, pageType: 'portfolio' },
  { key: 'business', name: 'Business', summary: 'Contact info and lead capture', icon: Globe, pageType: 'link-in-bio' },
  { key: 'business-card', name: 'Digital business card', summary: 'Contact information and vCard download', icon: Users, pageType: 'business-card' },
];

const freshBlock = (type, n) => {
  const id = 'block-' + Date.now().toString(36) + '-' + n + '-' + Math.random().toString(36).slice(2, 6);
  if (type === 'link') return { id, type, label: 'New link', url: 'https://example.com', description: '', icon: 'link', featured: false, visible: true };
  if (type === 'social') return { id, type, label: 'Social profile', url: 'https://example.com', platform: 'website', visible: true };
  if (type === 'heading') return { id, type, text: 'Section heading', visible: true };
  if (type === 'text') return { id, type, text: 'Add a short introduction or description.', visible: true };
  if (type === 'image') return { id, type, url: 'https://example.com/image.png', alt: 'Image description', caption: '', visible: true };
  if (type === 'video') return { id, type, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Featured video', visible: true };
  if (type === 'lead_form') return { id, type, title: 'Get in touch', description: 'Leave your details and I will get back to you.', buttonLabel: 'Send message', visible: true };
  if (type === 'file') return { id, type, label: 'Download file', url: 'https://example.com/file.pdf', visible: true };
  return { id, type: 'divider', style: 'line', visible: true };
};

const starterBlocks = (key) => {
  if (key === 'creator') return [
    { ...freshBlock('heading', 1), text: 'Featured' },
    { ...freshBlock('link', 2), label: 'Latest work', url: 'https://example.com', featured: true },
    { ...freshBlock('social', 3), label: 'Instagram', url: 'https://instagram.com', platform: 'instagram' },
    { ...freshBlock('social', 4), label: 'YouTube', url: 'https://youtube.com', platform: 'youtube' },
  ];
  if (key === 'developer') return [
    { ...freshBlock('heading', 1), text: 'Selected projects' },
    { ...freshBlock('link', 2), label: 'Portfolio', url: 'https://example.com', featured: true },
    { ...freshBlock('social', 3), label: 'GitHub', url: 'https://github.com', platform: 'github' },
    { ...freshBlock('social', 4), label: 'LinkedIn', url: 'https://linkedin.com', platform: 'linkedin' },
  ];
  if (key === 'business') return [
    { ...freshBlock('heading', 1), text: 'Work with us' },
    { ...freshBlock('link', 2), label: 'Visit our website', url: 'https://example.com', featured: true },
    { ...freshBlock('lead_form', 3) },
  ];
  if (key === 'business-card') return [
    { ...freshBlock('text', 1), text: 'Save my contact details or use the links below.' },
    { ...freshBlock('social', 2), label: 'Company website', url: 'https://example.com', platform: 'website' },
    { ...freshBlock('social', 3), label: 'LinkedIn', url: 'https://linkedin.com', platform: 'linkedin' },
  ];
  return [
    { ...freshBlock('link', 1), label: 'My portfolio', url: 'https://example.com', featured: true },
    { ...freshBlock('social', 2), label: 'GitHub', url: 'https://github.com', platform: 'github' },
  ];
};

const fromApi = (page) => ({
  ...page,
  profileImageUrl: page.profile_image_url || '',
  pageType: page.page_type || 'link-in-bio',
  templateKey: page.template_key || 'minimal',
  theme: page.theme || { mode: 'light', accent: '#2563eb', background: '#f8fafc', buttonStyle: 'rounded', font: 'inter', layout: 'centered' },
  blocks: Array.isArray(page.blocks) ? page.blocks : [],
  seoTitle: page.seo_title || '',
  seoDescription: page.seo_description || '',
  ogImageUrl: page.og_image_url || '',
  publishAt: page.publish_at ? new Date(page.publish_at).toISOString().slice(0, 16) : '',
  unpublishAt: page.unpublish_at ? new Date(page.unpublish_at).toISOString().slice(0, 16) : '',
  customDomainId: page.custom_domain_id || '',
  contactEmail: page.contact_email || '',
  contactPhone: page.contact_phone || '',
  contactCompany: page.contact_company || '',
  contactJobTitle: page.contact_job_title || '',
});

const toApi = (form) => ({
  slug: form.slug,
  title: form.title,
  bio: form.bio,
  profileImageUrl: form.profileImageUrl || null,
  pageType: form.pageType,
  templateKey: form.templateKey,
  theme: form.theme,
  blocks: form.blocks,
  status: form.status,
  seoTitle: form.seoTitle || null,
  seoDescription: form.seoDescription || null,
  ogImageUrl: form.ogImageUrl || null,
  publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
  unpublishAt: form.unpublishAt ? new Date(form.unpublishAt).toISOString() : null,
  customDomainId: form.customDomainId || null,
  contactEmail: form.contactEmail || null,
  contactPhone: form.contactPhone || null,
  contactCompany: form.contactCompany || null,
  contactJobTitle: form.contactJobTitle || null,
});

const publicUrl = (slug) => window.location.origin + '/p/' + slug;
const pagePublicUrl = (page) => page.custom_domain && page.domain_status === 'active' ? 'https://' + page.custom_domain : publicUrl(page.slug);
const displayPageStatus = (page) => page.status === 'published' && page.publish_at && new Date(page.publish_at) > new Date() ? 'scheduled' : page.status === 'published' && page.unpublish_at && new Date(page.unpublish_at) <= new Date() ? 'expired' : page.status;

export default function PagesPage() {
  const [pages, setPages] = useState([]);
  const [domains, setDomains] = useState([]);
  const [quota, setQuota] = useState({ pages: 3, blocks: 25 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', slug: '', templateKey: 'minimal' });
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState('editor');
  const [analytics, setAnalytics] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [leads, setLeads] = useState([]);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadPages = async () => {
    setLoading(true);
    try {
      const [pageRes, domainRes] = await Promise.all([
        api.get('/pages'),
        api.get('/domains').catch(() => ({ data: { data: [] } })),
      ]);
      setPages(pageRes.data.data || []);
      setQuota(pageRes.data.quota || { pages: 3, blocks: 25 });
      setDomains((domainRes.data.data || []).filter(d => d.domain_type === 'page' && d.status === 'active'));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load your pages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPages(); }, []);

  const openEditor = async (page) => {
    try {
      const res = await api.get('/pages/' + page.id);
      setSelected(page.id);
      setForm(fromApi(res.data.data));
      setPanel('editor');
      setAnalytics(null);
      setLeads([]);
      setRevisions([]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not open page.');
    }
  };

  const createPage = async (event) => {
    event.preventDefault();
    const title = createForm.title.trim();
    const slug = createForm.slug.trim().toLowerCase();
    if (!title || !slug) return toast.error('Enter a page title and URL name.');
    const template = TEMPLATES.find(t => t.key === createForm.templateKey) || TEMPLATES[0];
    setSaving(true);
    try {
      const res = await api.post('/pages', {
        title, slug, templateKey: template.key, pageType: template.pageType,
        status: 'draft',
        theme: { mode: 'light', accent: '#2563eb', background: '#f8fafc', buttonStyle: 'rounded', font: 'inter', layout: 'centered' },
        blocks: starterBlocks(template.key),
        seoTitle: title,
      });
      const page = res.data.data;
      setCreating(false);
      setCreateForm({ title: '', slug: '', templateKey: 'minimal' });
      await loadPages();
      await openEditor(page);
      toast.success('Draft created. Customize it before publishing.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create page.');
    } finally {
      setSaving(false);
    }
  };

  const savePage = async (event) => {
    if (event) event.preventDefault();
    if (!form || !selected) return;
    setSaving(true);
    try {
      const res = await api.patch('/pages/' + selected, toApi(form));
      setForm(fromApi(res.data.data));
      await loadPages();
      toast.success('Page saved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save page. Check the slug, blocks and URLs.');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (page) => {
    try {
      await api.post('/pages/' + page.id + '/duplicate');
      await loadPages();
      toast.success('A draft copy was created.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not duplicate this page.');
    }
  };

  const deletePage = async (page) => {
    if (!confirm('Permanently delete "' + page.title + '" and its page analytics/leads?')) return;
    try {
      await api.delete('/pages/' + page.id);
      if (selected === page.id) { setSelected(null); setForm(null); }
      await loadPages();
      toast.success('Page deleted.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete page.');
    }
  };

  const showAnalytics = async () => {
    setPanel('analytics');
    try {
      const res = await api.get('/pages/' + selected + '/analytics');
      setAnalytics(res.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load analytics.');
    }
  };

  const showRevisions = async () => {
    setPanel('history');
    try {
      const res = await api.get('/pages/' + selected + '/revisions');
      setRevisions(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load page history.');
    }
  };

  const restoreRevision = async (revision) => {
    if (!confirm('Restore the saved version from ' + new Date(revision.created_at).toLocaleString() + '? The current content will be preserved in history.')) return;
    setSaving(true);
    try {
      const res = await api.post('/pages/' + selected + '/revisions/' + revision.id + '/restore');
      setForm(fromApi(res.data.data));
      await loadPages();
      const revisionsRes = await api.get('/pages/' + selected + '/revisions');
      setRevisions(revisionsRes.data.data || []);
      setPanel('history');
      toast.success('Saved version restored.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not restore version.');
    } finally {
      setSaving(false);
    }
  };

  const showLeads = async () => {
    setPanel('leads');
    try {
      const res = await api.get('/pages/' + selected + '/leads');
      setLeads(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load leads.');
    }
  };

  const exportLeadsCsv = () => {
    if (!leads.length) return toast.error('There are no leads to export.');
    const cell = (value) => '"' + String(value ?? '').replaceAll('"', '""').replaceAll('\r', ' ').replaceAll('\n', ' ') + '"';
    const rows = [
      ['Name','Email','Message','Consent','Received at'],
      ...leads.map(lead => [lead.name, lead.email, lead.message || '', lead.consent ? 'yes' : 'no', new Date(lead.created_at).toISOString()]),
    ];
    const blob = new Blob([rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'axly-page-leads-' + new Date().toISOString().slice(0,10) + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const suggestCopy = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await api.post('/pages/' + selected + '/ai-copy', { topic: aiTopic });
      const data = res.data.data || {};
      setForm(prev => ({ ...prev, title: data.title || prev.title, bio: data.bio || prev.bio, seoTitle: data.seoTitle || prev.seoTitle, seoDescription: data.seoDescription || prev.seoDescription }));
      toast.success('Suggestions added to the draft. Save to keep them.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'AI suggestions are not configured on the backend yet.');
    } finally {
      setAiLoading(false);
    }
  };

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateTheme = (key, value) => setForm(prev => ({ ...prev, theme: { ...prev.theme, [key]: value } }));
  const updateBlock = (index, key, value) => setForm(prev => {
    const blocks = prev.blocks.slice();
    blocks[index] = { ...blocks[index], [key]: value };
    return { ...prev, blocks };
  });
  const moveBlock = (index, delta) => setForm(prev => {
    const blocks = prev.blocks.slice();
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return prev;
    const temp = blocks[index];
    blocks[index] = blocks[target];
    blocks[target] = temp;
    return { ...prev, blocks };
  });
  const addBlock = (type) => {
    if (!form) return;
    if (form.blocks.length >= quota.blocks) return toast.error('Your current plan supports up to ' + quota.blocks + ' blocks per page.');
    setForm(prev => ({ ...prev, blocks: [...prev.blocks, freshBlock(type, prev.blocks.length + 1)] }));
  };
  const applyTemplate = () => {
    const template = TEMPLATES.find(t => t.key === form.templateKey) || TEMPLATES[0];
    if (!confirm('Replace your current blocks with the starter blocks for "' + template.name + '"?')) return;
    setForm(prev => ({ ...prev, blocks: starterBlocks(template.key), pageType: template.pageType }));
  };
  const copyPageUrl = async (slug) => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      toast.success('Page URL copied.');
    } catch {
      toast.error('Could not copy the URL.');
    }
  };

  if (loading) return <div className="page-container"><div className="card">Loading your pages…</div></div>;

  if (!selected || !form) {
    return (
      <div className="page-container pages-studio">
        <div className="page-header">
          <div>
            <div className="profile-eyebrow">PUBLISH YOUR PRESENCE</div>
            <h1 className="page-title">My Pages</h1>
            <p className="page-subtitle">Build a link-in-bio page, developer portfolio or digital business card under your own brand.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)} disabled={pages.length >= quota.pages}>
            <Plus size={16} /> Create page
          </button>
        </div>

        <div className="pages-stats-grid">
          <div className="card pages-stat"><PanelsTopLeft size={20} /><span>Pages created</span><strong>{pages.length} / {quota.pages}</strong></div>
          <div className="card pages-stat"><Eye size={20} /><span>Total page views</span><strong>{pages.reduce((sum, p) => sum + Number(p.views || 0), 0).toLocaleString()}</strong></div>
          <div className="card pages-stat"><Link2 size={20} /><span>Button clicks</span><strong>{pages.reduce((sum, p) => sum + Number(p.clicks || 0), 0).toLocaleString()}</strong></div>
        </div>

        {pages.length === 0 ? (
          <div className="card pages-empty">
            <div className="pages-empty-icon"><PanelsTopLeft size={28} /></div>
            <h2>Create your first public page</h2>
            <p>Bring your portfolio, projects, social profiles and contact details together in one shareable page.</p>
            <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Start building</button>
          </div>
        ) : (
          <div className="pages-grid">
            {pages.map(page => (
              <article className="card page-list-card" key={page.id}>
                <div className="page-card-cover" style={{ background: page.template_key === 'business-card' ? 'linear-gradient(135deg,#0f172a,#334155)' : 'linear-gradient(135deg,' + ((page.id.charCodeAt(0) % 2) ? '#dbeafe,#ede9fe' : '#cffafe,#dbeafe') + ')' }}>
                  <div className="page-card-cover-icon"><PanelsTopLeft size={23} /></div>
                  <span className={'badge ' + (page.status === 'published' ? 'badge-active' : 'badge-warning')}>{displayPageStatus(page)}</span>
                </div>
                <div className="page-list-card-body">
                  <h3>{page.title}</h3>
                  <p className="page-card-slug">/p/{page.slug}</p>
                  <p className="page-card-bio">{page.bio || 'Add a short bio to introduce this page.'}</p>
                  <div className="page-card-metrics">
                    <span><Eye size={14} /> {Number(page.views || 0).toLocaleString()} views</span>
                    <span><Link2 size={14} /> {Number(page.clicks || 0).toLocaleString()} clicks</span>
                  </div>
                  {page.custom_domain && <div className="page-domain-chip"><Globe size={13} /> {page.custom_domain}</div>}
                  <div className="page-card-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => openEditor(page)}><Edit3 size={14} /> Edit</button>
                    {page.status === 'published' && <a className="btn btn-secondary btn-sm" href={pagePublicUrl(page)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>}
                    <button className="btn btn-secondary btn-sm" onClick={() => duplicate(page)} title="Duplicate page"><Copy size={14} /></button>
                    <button className="btn btn-secondary btn-sm" onClick={() => deletePage(page)} title="Delete page"><Trash2 size={14} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {creating && (
          <div className="modal-backdrop">
            <div className="modal-card pages-create-modal">
              <h2>Create a page</h2>
              <p>Choose a starting point. You can customize the content and design before publishing.</p>
              <form onSubmit={createPage} className="pages-create-form">
                <div className="form-group">
                  <label className="form-label">Page name</label>
                  <input className="form-input" value={createForm.title} onChange={e => setCreateForm(prev => ({ ...prev, title: e.target.value, slug: prev.slug || e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))} placeholder="Ravi Kiran" maxLength={160} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Public URL name</label>
                  <div className="pages-slug-field"><span>/p/</span><input className="form-input" value={createForm.slug} onChange={e => setCreateForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().trim() }))} placeholder="ravikiran" minLength={3} maxLength={64} required /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Starting template</label>
                  <div className="pages-template-grid">
                    {TEMPLATES.map(template => {
                      const Icon = template.icon;
                      return <button type="button" className={'pages-template-option ' + (createForm.templateKey === template.key ? 'selected' : '')} key={template.key} onClick={() => setCreateForm(prev => ({ ...prev, templateKey: template.key }))}>
                        <Icon size={20} /><strong>{template.name}</strong><span>{template.summary}</span>
                      </button>;
                    })}
                  </div>
                </div>
                <div className="pages-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create draft'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container pages-studio pages-editor">
      <div className="page-header pages-editor-header">
        <div>
          <button className="pages-back-link" onClick={() => { setSelected(null); setForm(null); loadPages(); }}><ArrowLeft size={15} /> All pages</button>
          <h1 className="page-title">{form.title || 'Untitled page'}</h1>
          <p className="page-subtitle">{form.status === 'published' ? 'Published page · changes are saved as you edit only when you press Save.' : 'Draft page · visitors cannot see it until you publish.'}</p>
        </div>
        <div className="pages-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => window.open(publicUrl(form.slug) + '?preview=1&pageId=' + selected, '_blank', 'noopener,noreferrer')}><Eye size={15} /> Preview</button>
          <button className="btn btn-primary" onClick={savePage} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>

      <div className="pages-workspace-tabs">
        <button className={panel === 'editor' ? 'active' : ''} onClick={() => setPanel('editor')}><Edit3 size={15} /> Editor</button>
        <button className={panel === 'analytics' ? 'active' : ''} onClick={showAnalytics}><BarChart3 size={15} /> Analytics</button>
        <button className={panel === 'leads' ? 'active' : ''} onClick={showLeads}><Users size={15} /> Leads</button>
        <button className={panel === 'history' ? 'active' : ''} onClick={showRevisions}><CalendarClock size={15} /> History</button>
      </div>

      {panel === 'analytics' && (
        <div className="page-analytics-panel">
          <div className="pages-stats-grid">
            {[
              ['Page views', analytics?.totals?.views || 0, Eye],
              ['Unique visitors', analytics?.totals?.unique_visitors || 0, Users],
              ['Button clicks', analytics?.totals?.clicks || 0, Link2],
              ['Captured leads', analytics?.totals?.leads || 0, Mail],
            ].map(([label, value, Icon]) => <div className="card pages-stat" key={label}><Icon size={20} /><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></div>)}
          </div>
          {!analytics ? <div className="card">Loading analytics…</div> : <div className="pages-analytics-columns">
            <div className="card"><h3>Daily activity · last 30 days</h3>
              {(analytics.daily || []).length === 0 ? <p className="pages-muted">No activity yet. Views and clicks appear after people visit the published page.</p> : <div className="pages-analytics-table"><table><thead><tr><th>Date</th><th>Views</th><th>Clicks</th></tr></thead><tbody>{analytics.daily.map(day => <tr key={day.day}><td>{day.day}</td><td>{day.views}</td><td>{day.clicks}</td></tr>)}</tbody></table></div>}
            </div>
            <div className="card"><h3>Top links</h3>{(analytics.topLinks || []).length === 0 ? <p className="pages-muted">No button clicks yet.</p> : analytics.topLinks.map(item => <div className="pages-ranked-row" key={item.block_id}><span>{item.label}</span><strong>{item.clicks}</strong></div>)}
              <h3 style={{ marginTop: 24 }}>Referrers</h3>{(analytics.referrers || []).map(item => <div className="pages-ranked-row" key={item.source}><span>{item.source}</span><strong>{item.views}</strong></div>)}
            </div>
          </div>}
        </div>
      )}

      {panel === 'history' && (
        <div className="card pages-history-card">
          <div className="pages-leads-heading">
            <div><h2>Version history</h2><p>Axly keeps snapshots before saved edits, so you can restore a previous version.</p></div>
            <button className="btn btn-secondary btn-sm" onClick={showRevisions}>Refresh</button>
          </div>
          {revisions.length === 0 ? (
            <div className="pages-empty-inline"><CalendarClock size={26}/><strong>No saved versions yet</strong><p>Save a content change to create the first revision.</p></div>
          ) : revisions.map(revision => (
            <div className="pages-revision-row" key={revision.id}>
              <div><strong>{revision.revision_label}</strong><span>{new Date(revision.created_at).toLocaleString()}</span></div>
              <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => restoreRevision(revision)}>Restore this version</button>
            </div>
          ))}
        </div>
      )}

      {panel === 'leads' && (
        <div className="card">
          <div className="pages-leads-heading"><div><h2>Contact form submissions</h2><p>Only you can see leads collected from your public page.</p></div><div style={{display:'flex',alignItems:'center',gap:8}}><span className="badge">{leads.length} loaded</span><button className="btn btn-secondary btn-sm" onClick={exportLeadsCsv} disabled={!leads.length}><Download size={14}/> Export CSV</button></div></div>
          {leads.length === 0 ? <div className="pages-empty-inline"><Mail size={26} /><strong>No leads yet</strong><p>Add a Lead capture block and publish your page to collect consented messages.</p></div> :
            <div className="pages-analytics-table"><table><thead><tr><th>Name</th><th>Email</th><th>Message</th><th>Received</th></tr></thead><tbody>{leads.map(lead => <tr key={lead.id}><td>{lead.name}</td><td><a href={'mailto:' + lead.email}>{lead.email}</a></td><td>{lead.message || '—'}</td><td>{new Date(lead.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
        </div>
      )}

      {panel === 'editor' && (
        <form className="pages-editor-grid" onSubmit={savePage}>
          <div className="pages-editor-main">
            <section className="card pages-form-card">
              <div className="pages-section-title"><div className="pages-section-icon"><UserIcon /></div><div><h2>Page identity</h2><p>How visitors recognize you or your brand.</p></div></div>
              <div className="pages-form-two">
                <div className="form-group"><label className="form-label">Page title</label><input className="form-input" value={form.title} onChange={e => updateForm('title', e.target.value)} maxLength={160} required /></div>
                <div className="form-group"><label className="form-label">Page URL</label><div className="pages-slug-field"><span>/p/</span><input className="form-input" value={form.slug} onChange={e => updateForm('slug', e.target.value.toLowerCase().trim())} minLength={3} maxLength={64} required /></div></div>
              </div>
              <div className="form-group"><label className="form-label">Short bio</label><textarea className="form-input" rows={3} value={form.bio} onChange={e => updateForm('bio', e.target.value)} maxLength={600} placeholder="Tell people who you are and what you do." /></div>
              <div className="form-group"><label className="form-label">Profile image URL</label><input className="form-input" type="url" value={form.profileImageUrl} onChange={e => updateForm('profileImageUrl', e.target.value)} placeholder="https://… (optional)" /></div>
              <div className="pages-form-two">
                <div className="form-group"><label className="form-label">Page type</label><select className="form-input" value={form.pageType} onChange={e => updateForm('pageType', e.target.value)}><option value="link-in-bio">Link in bio</option><option value="portfolio">Portfolio</option><option value="creator">Creator</option><option value="business-card">Digital business card</option></select></div>
                <div className="form-group"><label className="form-label">Template</label><div className="pages-template-select-row"><select className="form-input" value={form.templateKey} onChange={e => updateForm('templateKey', e.target.value)}>{TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}</select><button type="button" className="btn btn-secondary btn-sm" onClick={applyTemplate}>Apply</button></div></div>
              </div>
            </section>

            <section className="card pages-form-card">
              <div className="pages-section-title"><div className="pages-section-icon"><Link2 size={17} /></div><div><h2>Content blocks</h2><p>Add links, text, social profiles, images, videos and lead forms. Drag ordering is represented by the up/down controls.</p></div></div>
              <div className="pages-add-blocks">
                {[['link','Link',Link2],['heading','Heading',Type],['text','Text',Type],['social','Social',Globe],['image','Image',Image],['video','Video',Video],['lead_form','Lead form',Mail],['divider','Divider',Minus],['file','File link',ExternalLink]].map(([key,label,Icon]) => <button type="button" key={key} onClick={() => addBlock(key)}><Icon size={14} /> {label}</button>)}
              </div>
              {form.blocks.length === 0 ? <div className="pages-empty-inline">This page has no blocks yet. Add your first link or content block.</div> : <div className="pages-block-list">
                {form.blocks.map((block,index) => (
                  <div className="pages-block-editor" key={block.id || index}>
                    <div className="pages-block-editor-header"><span className="pages-block-type">{block.type.replace('_',' ')}</span><div className="pages-block-order"><button type="button" title="Move up" disabled={index===0} onClick={() => moveBlock(index,-1)}><ArrowUp size={14}/></button><button type="button" title="Move down" disabled={index===form.blocks.length-1} onClick={() => moveBlock(index,1)}><ArrowDown size={14}/></button><button type="button" title="Remove block" onClick={() => setForm(prev => ({...prev,blocks:prev.blocks.filter((_,i) => i!==index)}))}><Trash2 size={14}/></button></div></div>
                    <label className="pages-visible-toggle"><input type="checkbox" checked={block.visible !== false} onChange={e => updateBlock(index,'visible',e.target.checked)} /> Show on public page</label>
                    {['link','social','file'].includes(block.type) && <div className="pages-form-two"><div className="form-group"><label className="form-label">Label</label><input className="form-input" value={block.label || ''} onChange={e => updateBlock(index,'label',e.target.value)} required maxLength={120}/></div><div className="form-group"><label className="form-label">Destination URL</label><input className="form-input" type="url" value={block.url || ''} onChange={e => updateBlock(index,'url',e.target.value)} required/></div></div>}
                    {block.type==='link' && <><div className="form-group"><label className="form-label">Description (optional)</label><input className="form-input" value={block.description || ''} onChange={e => updateBlock(index,'description',e.target.value)} maxLength={240}/></div><label className="pages-visible-toggle"><input type="checkbox" checked={block.featured===true} onChange={e=>updateBlock(index,'featured',e.target.checked)}/> Feature this link</label></>}
                    {['heading','text'].includes(block.type) && <div className="form-group"><label className="form-label">Text</label><textarea className="form-input" rows={block.type==='heading'?2:3} value={block.text || ''} onChange={e=>updateBlock(index,'text',e.target.value)} maxLength={1600} required/></div>}
                    {block.type==='social' && <div className="form-group"><label className="form-label">Platform</label><select className="form-input" value={block.platform || 'website'} onChange={e=>updateBlock(index,'platform',e.target.value)}>{['website','github','linkedin','instagram','youtube','tiktok','x','facebook','email'].map(v=><option key={v} value={v}>{v}</option>)}</select></div>}
                    {block.type==='image' && <><div className="form-group"><label className="form-label">Image URL (HTTPS)</label><input className="form-input" type="url" value={block.url || ''} onChange={e=>updateBlock(index,'url',e.target.value)} required/></div><div className="form-group"><label className="form-label">Alt text</label><input className="form-input" value={block.alt || ''} onChange={e=>updateBlock(index,'alt',e.target.value)} maxLength={180}/></div></>}
                    {block.type==='video' && <><div className="form-group"><label className="form-label">YouTube or Vimeo URL</label><input className="form-input" type="url" value={block.url || ''} onChange={e=>updateBlock(index,'url',e.target.value)} required/></div><div className="form-group"><label className="form-label">Video title</label><input className="form-input" value={block.title || ''} onChange={e=>updateBlock(index,'title',e.target.value)} maxLength={180}/></div></>}
                    {block.type==='lead_form' && <><div className="form-group"><label className="form-label">Form title</label><input className="form-input" value={block.title || ''} onChange={e=>updateBlock(index,'title',e.target.value)} maxLength={120}/></div><div className="form-group"><label className="form-label">Description</label><input className="form-input" value={block.description || ''} onChange={e=>updateBlock(index,'description',e.target.value)} maxLength={240}/></div><div className="form-group"><label className="form-label">Button label</label><input className="form-input" value={block.buttonLabel || ''} onChange={e=>updateBlock(index,'buttonLabel',e.target.value)} maxLength={40}/></div></>}
                    {block.type==='divider' && <p className="pages-muted">A visual separator will appear between blocks.</p>}
                  </div>
                ))}
              </div>}
              <p className="pages-muted">{form.blocks.length} / {quota.blocks} blocks allowed by your current plan.</p>
            </section>

            <section className="card pages-form-card">
              <div className="pages-section-title"><div className="pages-section-icon"><Palette size={17}/></div><div><h2>Design and theme</h2><p>Choose the visual treatment for your public page.</p></div></div>
              <div className="pages-theme-swatches">{[
                ['Cobalt','#2563eb','#f8fafc'],['Violet','#7c3aed','#faf5ff'],['Forest','#047857','#f0fdf4'],['Graphite','#334155','#f8fafc'],['Rose','#e11d48','#fff1f2']
              ].map(([label,accent,background])=><button type="button" key={label} className={'pages-theme-swatch ' + (form.theme.accent===accent?'selected':'')} onClick={()=>setForm(prev=>({...prev,theme:{...prev.theme,accent,background,mode:'light'}}))}><span style={{background:accent}}/><strong>{label}</strong></button>)}</div>
              <div className="pages-form-two">
                <div className="form-group"><label className="form-label">Mode</label><select className="form-input" value={form.theme.mode} onChange={e=>updateTheme('mode',e.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></div>
                <div className="form-group"><label className="form-label">Button shape</label><select className="form-input" value={form.theme.buttonStyle} onChange={e=>updateTheme('buttonStyle',e.target.value)}><option value="rounded">Rounded</option><option value="pill">Pill</option><option value="square">Square</option></select></div>
              </div>
              <div className="pages-form-two">
                <div className="form-group"><label className="form-label">Accent color</label><input className="form-input pages-color-input" type="color" value={form.theme.accent} onChange={e=>updateTheme('accent',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Background color</label><input className="form-input pages-color-input" type="color" value={form.theme.background} onChange={e=>updateTheme('background',e.target.value)}/></div>
              </div>
            </section>

            <section className="card pages-form-card">
              <div className="pages-section-title"><div className="pages-section-icon"><Users size={17}/></div><div><h2>Business card contact</h2><p>Optional contact fields and vCard download for digital business-card pages.</p></div></div>
              <div className="pages-form-two">
                <div className="form-group"><label className="form-label">Contact email</label><input className="form-input" type="email" value={form.contactEmail} onChange={e=>updateForm('contactEmail',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.contactPhone} onChange={e=>updateForm('contactPhone',e.target.value)} maxLength={80}/></div>
                <div className="form-group"><label className="form-label">Company</label><input className="form-input" value={form.contactCompany} onChange={e=>updateForm('contactCompany',e.target.value)} maxLength={160}/></div>
                <div className="form-group"><label className="form-label">Job title</label><input className="form-input" value={form.contactJobTitle} onChange={e=>updateForm('contactJobTitle',e.target.value)} maxLength={160}/></div>
              </div>
            </section>

            <section className="card pages-form-card">
              <div className="pages-section-title"><div className="pages-section-icon"><CalendarClock size={17}/></div><div><h2>Publishing and SEO</h2><p>Schedule visibility and control how the page appears in search/social previews.</p></div></div>
              <div className="pages-form-two">
                <div className="form-group"><label className="form-label">Status</label><select className="form-input" value={form.status} onChange={e=>updateForm('status',e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
                <div className="form-group"><label className="form-label">Custom page domain</label><select className="form-input" value={form.customDomainId} onChange={e=>updateForm('customDomainId',e.target.value)}><option value="">Default Axly URL</option>{domains.map(d=><option key={d.id} value={d.id}>{d.domain}</option>)}</select><small className="pages-muted">Connect and verify a page domain in Developer Platform → Domains first.</small></div>
              </div>
              <div className="pages-form-two">
                <div className="form-group"><label className="form-label">Publish at (optional)</label><input type="datetime-local" className="form-input" value={form.publishAt} onChange={e=>updateForm('publishAt',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">Unpublish at (optional)</label><input type="datetime-local" className="form-input" value={form.unpublishAt} onChange={e=>updateForm('unpublishAt',e.target.value)}/></div>
              </div>
              <div className="form-group"><label className="form-label">SEO title</label><input className="form-input" value={form.seoTitle} onChange={e=>updateForm('seoTitle',e.target.value)} maxLength={180}/></div>
              <div className="form-group"><label className="form-label">SEO description</label><textarea className="form-input" rows={2} value={form.seoDescription} onChange={e=>updateForm('seoDescription',e.target.value)} maxLength={320}/></div>
              <div className="form-group"><label className="form-label">Social sharing image URL (optional)</label><input type="url" className="form-input" value={form.ogImageUrl} onChange={e=>updateForm('ogImageUrl',e.target.value)} placeholder="https://…"/></div>
            </section>
          </div>

          <aside className="pages-editor-side">
            <section className="card pages-side-card">
              <div className="pages-section-title"><div className="pages-section-icon"><Eye size={17}/></div><div><h2>Publish</h2><p>Changes are not saved until you save the page.</p></div></div>
              <div className="pages-publish-preview"><strong>{form.title || 'Untitled page'}</strong><span>{publicUrl(form.slug || 'your-page')}</span><span className={'badge ' + (form.status==='published'?'badge-active':'badge-warning')}>{form.status}</span></div>
              <button type="button" className="btn btn-primary" style={{width:'100%'}} onClick={async()=>{updateForm('status','published');setSaving(true);try{const res=await api.patch('/pages/'+selected,{...toApi(form),status:'published'});setForm(fromApi(res.data.data));await loadPages();toast.success('Page published.');}catch(error){toast.error(error.response?.data?.message||'Could not publish page.');}finally{setSaving(false);}}} disabled={saving}><Send size={15}/> Publish page</button>
              <button type="button" className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={savePage} disabled={saving}><Save size={15}/> Save draft changes</button>
              {form.status === 'published' && <a className="btn btn-secondary" style={{width:'100%',marginTop:8}} href={publicUrl(form.slug)} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open live page</a>}
            </section>
            <section className="card pages-side-card">
              <div className="pages-section-title"><div className="pages-section-icon"><PenTool size={17}/></div><div><h2>Copy suggestion helper</h2><p>Optional server-configured provider. Review any copy before saving.</p></div></div>
              <input className="form-input" placeholder="What is this page about?" value={aiTopic} onChange={e=>setAiTopic(e.target.value)}/>
              <button type="button" className="btn btn-secondary" style={{width:'100%',marginTop:10}} onClick={suggestCopy} disabled={aiLoading}>{aiLoading?'Generating…':'Suggest title and bio'}</button>
            </section>
            <section className="card pages-side-card">
              <div className="pages-section-title"><div className="pages-section-icon"><Globe size={17}/></div><div><h2>Custom domain</h2><p>Use a domain you own for this page.</p></div></div>
              {form.customDomainId ? <p className="pages-domain-ready">{domains.find(d=>d.id===form.customDomainId)?.domain || 'Connected page domain'}</p> : <p className="pages-muted">Connect a domain in Developer Platform → Domains to use a branded address.</p>}
              <a className="profile-overview-link" href="/app/developer">Open developer platform <ExternalLink size={14}/></a>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}

function UserIcon() {
  return <Users size={17} />;
}
