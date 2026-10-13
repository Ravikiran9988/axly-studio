import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, Download, Search, ExternalLink,
  BarChart3, Calendar, Tag, Trash2, ArrowRight,
  Copy, Check, Filter,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignLinks, setCampaignLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  // UTM Builder & Form State
  const [form, setForm] = useState({
    name: '',
    description: '',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: '',
    utmTerm: '',
    utmContent: '',
    testBaseUrl: 'https://example.com/landing',
  });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data.data || []);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Load links for selected campaign
  const handleSelectCampaign = async (camp) => {
    setSelectedCampaign(camp);
    setLoadingLinks(true);
    try {
      const res = await api.get(`/campaigns/${camp.id}`);
      setCampaignLinks(res.data.data.links || []);
    } catch {
      toast.error('Failed to load campaign links');
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        utmSource: form.utmSource.trim(),
        utmMedium: form.utmMedium.trim(),
        utmCampaign: form.utmCampaign.trim() || form.name.toLowerCase().replace(/\s+/g, '-'),
        utmTerm: form.utmTerm.trim(),
        utmContent: form.utmContent.trim(),
      };

      const res = await api.post('/campaigns', payload);
      toast.success('Campaign created successfully.');
      setShowCreate(false);
      setForm({
        name: '',
        description: '',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: '',
        utmTerm: '',
        utmContent: '',
        testBaseUrl: 'https://example.com/landing',
      });
      fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create campaign');
    }
  };

  const handleDeleteCampaign = async (campId) => {
    if (!confirm('Are you sure you want to delete this campaign? Existing links will be detached.')) return;
    try {
      await api.delete(`/campaigns/${campId}`);
      toast.success('Campaign deleted');
      if (selectedCampaign?.id === campId) setSelectedCampaign(null);
      fetchCampaigns();
    } catch {
      toast.error('Failed to delete campaign');
    }
  };

  const handleExportCsv = async (campId, campName) => {
    try {
      const res = await api.get(`/campaigns/${campId}/export/csv`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `campaign-${campName || campId}-analytics.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Campaign analytics exported!');
    } catch {
      toast.error('Failed to export campaign CSV');
    }
  };

  // Compute live UTM URL preview
  const previewUrl = (() => {
    try {
      const u = new URL(form.testBaseUrl || 'https://example.com');
      if (form.utmSource) u.searchParams.set('utm_source', form.utmSource);
      if (form.utmMedium) u.searchParams.set('utm_medium', form.utmMedium);
      const c = form.utmCampaign || form.name.toLowerCase().replace(/\s+/g, '-');
      if (c) u.searchParams.set('utm_campaign', c);
      if (form.utmTerm) u.searchParams.set('utm_term', form.utmTerm);
      if (form.utmContent) u.searchParams.set('utm_content', form.utmContent);
      return u.toString();
    } catch {
      return 'Invalid URL';
    }
  })();

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns & UTM Intelligence</h1>
          <p className="page-subtitle">
            Track multi-channel initiatives with automatic UTM attribution and source comparisons
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {/* Campaign Creation / UTM Builder Drawer */}
      {showCreate && (
        <div className="card" style={{ padding: '24px', marginBottom: 28, border: '1px solid var(--brand-primary)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>UTM Campaign Builder</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Create a standardized campaign taxonomy with collision-safe query formatting.
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Close</button>
          </div>

          <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Campaign Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Summer Launch 2026"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Paid search and newsletter launch push"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">utm_source *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. google, twitter, newsletter, linkedin"
                  value={form.utmSource}
                  onChange={e => setForm(p => ({ ...p, utmSource: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">utm_medium *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. cpc, email, social, referral"
                  value={form.utmMedium}
                  onChange={e => setForm(p => ({ ...p, utmMedium: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">utm_campaign</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Leave empty to use slugified campaign name"
                  value={form.utmCampaign}
                  onChange={e => setForm(p => ({ ...p, utmCampaign: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">utm_term (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. link-management-saas"
                  value={form.utmTerm}
                  onChange={e => setForm(p => ({ ...p, utmTerm: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">utm_content (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. top_banner_cta, hero_variant_b"
                  value={form.utmContent}
                  onChange={e => setForm(p => ({ ...p, utmContent: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Base URL Preview Test</label>
                <input
                  type="url"
                  className="form-input"
                  value={form.testBaseUrl}
                  onChange={e => setForm(p => ({ ...p, testBaseUrl: e.target.value }))}
                />
              </div>
            </div>

            {/* Live UTM Preview Card */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                Preview generated destination:
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                color: 'var(--brand-primary)',
                wordBreak: 'break-all',
              }}>
                {previewUrl}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save & Activate Campaign
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="campaigns-layout-grid" style={{ display: 'grid', gridTemplateColumns: selectedCampaign ? '1fr 1fr' : '1fr', gap: 24 }}>
        {/* Campaign Cards List */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>Active Campaigns ({campaigns.length})</h2>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="empty-state card" style={{ padding: '40px' }}>
              <div className="empty-icon"><Megaphone size={36} /></div>
              <div className="empty-title">No campaigns created yet</div>
              <div className="empty-desc">
                Organize your marketing links with UTM channels, conversion rates, and CSV exports.
              </div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={15} /> Create your first campaign
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {campaigns.map(camp => {
                const isSelected = selectedCampaign?.id === camp.id;
                return (
                  <div
                    key={camp.id}
                    className={`card ${isSelected ? 'selected' : ''}`}
                    style={{
                      padding: '20px',
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--brand-primary)' : undefined,
                    }}
                    onClick={() => handleSelectCampaign(camp)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {camp.name}
                        </h3>
                        {camp.description && (
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {camp.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button
                          className="copy-btn"
                          onClick={() => handleExportCsv(camp.id, camp.name)}
                          title="Export campaign CSV"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          className="copy-btn"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          title="Delete campaign"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* UTM Badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      <span className="badge" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--brand-primary)' }}>
                        source: {camp.utm_source || 'any'}
                      </span>
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                        medium: {camp.utm_medium || 'any'}
                      </span>
                      {camp.utm_campaign && (
                        <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          campaign: {camp.utm_campaign}
                        </span>
                      )}
                    </div>

                    {/* Performance metrics */}
                    <div style={{ display: 'flex', gap: 24, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                      <div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{camp.link_count || 0}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Associated Links</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{parseInt(camp.total_clicks || 0).toLocaleString()}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Clicks</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
                          {parseInt(camp.unique_clicks || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unique Visitors</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Campaign Detail Panel */}
        {selectedCampaign && (
          <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selectedCampaign.name}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Campaign Links & Performance</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCampaign(null)}>Close</button>
            </div>

            {loadingLinks ? (
              <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
            ) : campaignLinks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No links linked to this campaign yet. You can attach links via the Link Details editor or bulk actions.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {campaignLinks.map(l => (
                  <div key={l.id} style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--brand-primary)' }}>
                        {l.short_code}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: 280 }}>
                        {l.original_url}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{l.click_count || 0}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>clicks</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
