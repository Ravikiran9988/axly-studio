import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Link2, Copy, Check, ExternalLink, QrCode,
  Calendar, Lock, ShieldCheck, Tag, Save, Plus, Trash2,
  Sliders, GitCompare, BarChart3, AlertTriangle, Smartphone,
  Clock, CheckCircle, RefreshCw, Eye, HeartPulse,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import QRModal from '../components/QRModal';
import toast from 'react-hot-toast';

export default function LinkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('settings'); // settings, rules, experiments, qr
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // General Settings Form
  const [formData, setFormData] = useState({
    title: '',
    originalUrl: '',
    expiresAt: '',
    notes: '',
    tags: [],
    tagInput: '',
    password: '',
    removePassword: false,
    isPreviewEnabled: false,
    status: 'active',
  });

  // Smart Rules State
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    ruleType: 'device',
    matchValue: 'mobile',
    destinationUrl: '',
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'UTC',
  });

  // A/B Experiment State
  const [experiment, setExperiment] = useState(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [showCreateExp, setShowCreateExp] = useState(false);
  const [expForm, setExpForm] = useState({
    name: 'Landing Page Test',
    conversionGoal: 'signup_completed',
    variants: [
      { name: 'Variant A (Control)', destinationUrl: '', weight: 50 },
      { name: 'Variant B (Challenger)', destinationUrl: '', weight: 50 },
    ],
  });

  // Fetch Link Data
  const fetchLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/urls/${id}`);
      const link = res.data.data;
      setUrl(link);
      setFormData({
        title: link.title || '',
        originalUrl: link.original_url || '',
        expiresAt: link.expires_at ? link.expires_at.split('T')[0] : '',
        notes: link.notes || '',
        tags: Array.isArray(link.tags) ? link.tags : [],
        tagInput: '',
        password: '',
        removePassword: false,
        isPreviewEnabled: Boolean(link.is_preview_enabled),
        status: link.status || 'active',
      });
    } catch {
      toast.error('Failed to load link details');
      navigate('/app/links');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // Fetch Smart Rules
  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await api.get(`/urls/${id}/rules`);
      setRules(res.data.data || []);
    } catch {
      // Non-critical if table or endpoint is empty
    } finally {
      setLoadingRules(false);
    }
  }, [id]);

  // Fetch Experiments
  const fetchExperiment = useCallback(async () => {
    setLoadingExp(true);
    try {
      const res = await api.get('/experiments');
      const found = res.data.data?.find(e => e.url_id === id);
      setExperiment(found || null);
    } catch {
      // Non-critical
    } finally {
      setLoadingExp(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLink();
  }, [fetchLink]);

  useEffect(() => {
    if (activeTab === 'rules') fetchRules();
    if (activeTab === 'experiments') fetchExperiment();
  }, [activeTab, fetchRules, fetchExperiment]);

  // Copy Short Link
  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url.short_url);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Tag Helpers
  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = formData.tagInput.trim().replace(/^,+|,+$/g, '');
      if (clean && !formData.tags.includes(clean)) {
        setFormData(p => ({
          ...p,
          tags: [...p.tags, clean],
          tagInput: '',
        }));
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(p => ({
      ...p,
      tags: p.tags.filter(t => t !== tagToRemove),
    }));
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        originalUrl: formData.originalUrl.trim(),
        notes: formData.notes,
        tags: formData.tags,
        isPreviewEnabled: formData.isPreviewEnabled,
        status: formData.status,
      };

      if (formData.expiresAt) {
        payload.expiresAt = new Date(formData.expiresAt).toISOString();
      } else {
        payload.expiresAt = null;
      }

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      } else if (formData.removePassword) {
        payload.removePassword = true;
      }

      const res = await api.patch(`/urls/${id}`, payload);
      setUrl(res.data.data);
      toast.success('Link settings saved successfully.');
      setFormData(p => ({ ...p, password: '', removePassword: false }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update link');
    } finally {
      setSaving(false);
    }
  };

  // Add Smart Rule
  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ruleType: newRule.ruleType,
        destinationUrl: newRule.destinationUrl.trim(),
      };

      if (newRule.ruleType === 'device') {
        payload.matchValue = newRule.matchValue;
      } else {
        payload.matchValue = `${newRule.startTime}-${newRule.endTime}`;
        payload.timezone = newRule.timezone;
      }

      await api.post(`/urls/${id}/rules`, payload);
      toast.success('Smart redirect rule created!');
      setShowAddRule(false);
      setNewRule({
        ruleType: 'device',
        matchValue: 'mobile',
        destinationUrl: '',
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'UTC',
      });
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create smart rule');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Delete this redirect rule?')) return;
    try {
      await api.delete(`/urls/${id}/rules/${ruleId}`);
      toast.success('Rule removed');
      fetchRules();
    } catch {
      toast.error('Failed to remove rule');
    }
  };

  // Create A/B Experiment
  const handleCreateExperiment = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        urlId: id,
        name: expForm.name,
        conversionGoal: expForm.conversionGoal,
        variants: expForm.variants.map(v => ({
          name: v.name,
          destinationUrl: v.destinationUrl.trim(),
          weight: parseInt(v.weight, 10),
        })),
      };

      const res = await api.post('/experiments', payload);
      setExperiment(res.data.data);
      setShowCreateExp(false);
      toast.success('A/B Experiment launched.');
      fetchExperiment();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create experiment');
    }
  };

  // Simulate Conversion Event Test
  const handleSimulateConversion = async () => {
    if (!experiment) return;
    try {
      await api.post(`/experiments/${experiment.id}/convert`, {
        visitorHash: 'preview-tester',
        value: 1,
      });
      toast.success('Test conversion event recorded!');
      fetchExperiment();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Conversion tracking error');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 40, width: 140, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (!url) return null;

  return (
    <div className="page-container">
      {/* Back button */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate('/app/links')}
        style={{ marginBottom: 16, paddingLeft: 0 }}
      >
        <ArrowLeft size={16} /> Back to My Links
      </button>

      {/* Hero Header Card */}
      <div className="card" style={{ padding: '24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className={`badge ${url.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                {url.status === 'active' ? 'Active' : 'Disabled'}
              </span>
              {url.custom_alias && (
                <span className="badge" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--brand-primary)' }}>
                  Custom Alias
                </span>
              )}
              {url.has_password && (
                <span className="badge" style={{ background: 'rgba(234,88,12,0.1)', color: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={11} /> Password Protected
                </span>
              )}
              {url.is_preview_enabled && (
                <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={11} /> Preview Interstitial
                </span>
              )}
              {url.health_status && url.health_status !== 'unknown' && (
                <span className="badge" style={{
                  background: url.health_status === 'healthy' ? '#ecfdf5' : '#fef2f2',
                  color: url.health_status === 'healthy' ? '#059669' : '#dc2626',
                  display: 'inline-flex', alignItems: 'center', gap: 4
                }}>
                  <HeartPulse size={11} /> {url.health_status.toUpperCase()}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-primary)', marginBottom: 6 }}>
              {url.short_url}
            </h1>
            <div className="url-original" style={{ fontSize: '0.88rem' }}>
              {url.original_url}
            </div>
          </div>

          {/* Action toolbar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy link">
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
            <a
              href={`${url.short_url}${url.is_preview_enabled ? '' : '?preview=1'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="copy-btn"
              title="Test Preview Interstitial Page"
            >
              <Eye size={13} /> Preview Page
            </a>
            <a href={url.short_url} target="_blank" rel="noopener noreferrer" className="copy-btn">
              <ExternalLink size={13} /> Visit
            </a>
            <button 
              className="copy-btn" 
              onClick={() => navigate(`/app/qr?url=${encodeURIComponent(url.short_url || url.original_url)}`)}
              title="Open in QR Code Generator"
            >
              <QrCode size={13} /> QR Studio
            </button>
            <button className="copy-btn" onClick={() => navigate(`/app/analytics/${url.id}`)}>
              <BarChart3 size={13} /> Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Sliders size={16} /> General & Security
        </button>
        <button
          className={`tab-item ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <Smartphone size={16} /> Smart Redirect Rules ({rules.length})
        </button>
        <button
          className={`tab-item ${activeTab === 'experiments' ? 'active' : ''}`}
          onClick={() => setActiveTab('experiments')}
        >
          <GitCompare size={16} /> A/B Experiment
        </button>
      </div>

      {/* TAB 1: General Settings & Security */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Core Link Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-title">Link Title</label>
                <input
                  id="edit-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Documentation Hub"
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  className="form-input"
                  value={formData.status}
                  onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                >
                  <option value="active">Active (Redirects visitors)</option>
                  <option value="inactive">Disabled (Returns 410 Gone)</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="edit-destination">Default Destination URL *</label>
                <input
                  id="edit-destination"
                  type="url"
                  className="form-input"
                  value={formData.originalUrl}
                  onChange={e => setFormData(p => ({ ...p, originalUrl: e.target.value }))}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Protected by SSRF destination guards against loopback, 169.254.x, and private networks.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-expires">Expiration Date</label>
                <input
                  id="edit-expires"
                  type="date"
                  className="form-input"
                  value={formData.expiresAt}
                  onChange={e => setFormData(p => ({ ...p, expiresAt: e.target.value }))}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Leave blank for permanent lifetime validity.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Tags (Press Enter or comma to add)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="marketing, internal, campaign2026..."
                  value={formData.tagInput}
                  onChange={e => setFormData(p => ({ ...p, tagInput: e.target.value }))}
                  onKeyDown={handleAddTag}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {formData.tags.map(t => (
                    <span key={t} className="tag-badge">
                      <Tag size={10} /> {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 3 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="edit-notes">Internal Notes & Annotations</label>
                <textarea
                  id="edit-notes"
                  className="form-input"
                  rows={3}
                  placeholder="Private notes visible only to your workspace..."
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Security & Access Protection Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Access Protection & Security</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Preview Interstitial Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Safety Preview Interstitial</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Display a safe destination confirmation page before forwarding visitors.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isPreviewEnabled}
                  onChange={e => setFormData(p => ({ ...p, isPreviewEnabled: e.target.checked }))}
                  style={{ width: 20, height: 20, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                />
              </div>

              <div style={{ height: 1, background: 'var(--border-color)' }} />

              {/* Password Protection */}
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>
                  Password Protection (Bcrypt Encrypted)
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  {url.has_password
                    ? 'This link is currently password-protected. Visitors must provide the passcode before routing.'
                    : 'Visitors must enter a passcode to unlock the link destination.'}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="password"
                    className="form-input"
                    style={{ maxWidth: 300 }}
                    placeholder={url.has_password ? 'Enter new passcode to change...' : 'Set access passcode...'}
                    value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value, removePassword: false }))}
                  />

                  {url.has_password && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--danger)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.removePassword}
                        onChange={e => setFormData(p => ({ ...p, removePassword: e.target.checked, password: '' }))}
                      />
                      Remove password protection
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ minWidth: 160 }}
            >
              {saving ? <><RefreshCw size={15} className="spinner" /> Saving...</> : <><Save size={15} /> Save Changes</>}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Smart Redirect Engine */}
      {activeTab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Deterministic Smart Routing Rules</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Evaluated in priority order. If a visitor matches, they route to the rule destination.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddRule(true)}>
              <Plus size={15} /> Add Redirect Rule
            </button>
          </div>

          {/* Add Rule Drawer/Modal */}
          {showAddRule && (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--brand-primary)', animation: 'slideUp 0.2s ease' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>New Smart Redirect Rule</h3>
              <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Rule Type</label>
                    <select
                      className="form-input"
                      value={newRule.ruleType}
                      onChange={e => setNewRule(p => ({ ...p, ruleType: e.target.value }))}
                    >
                      <option value="device">Device Category (Mobile / Tablet / Desktop)</option>
                      <option value="time">Time Window (Time of Day)</option>
                    </select>
                  </div>

                  {newRule.ruleType === 'device' ? (
                    <div className="form-group">
                      <label className="form-label">Target Device</label>
                      <select
                        className="form-input"
                        value={newRule.matchValue}
                        onChange={e => setNewRule(p => ({ ...p, matchValue: e.target.value }))}
                      >
                        <option value="mobile">Mobile Phones</option>
                        <option value="tablet">Tablets & iPads</option>
                        <option value="desktop">Desktop & Laptops</option>
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Active Time Window</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="time"
                            className="form-input"
                            value={newRule.startTime}
                            onChange={e => setNewRule(p => ({ ...p, startTime: e.target.value }))}
                            required
                          />
                          <span>to</span>
                          <input
                            type="time"
                            className="form-input"
                            value={newRule.endTime}
                            onChange={e => setNewRule(p => ({ ...p, endTime: e.target.value }))}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Timezone</label>
                        <select
                          className="form-input"
                          value={newRule.timezone}
                          onChange={e => setNewRule(p => ({ ...p, timezone: e.target.value }))}
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/New_York">America/New_York (EST/EDT)</option>
                          <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                          <option value="Europe/London">Europe/London (GMT/BST)</option>
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Redirect Target URL *</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://apps.apple.com/app/id123..."
                    value={newRule.destinationUrl}
                    onChange={e => setNewRule(p => ({ ...p, destinationUrl: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddRule(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save Rule
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rules List */}
          {loadingRules ? (
            <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
          ) : rules.length === 0 ? (
            <div className="empty-state card" style={{ padding: '40px' }}>
              <div className="empty-icon"><GitCompare size={36} /></div>
              <div className="empty-title">No smart redirect rules configured</div>
              <div className="empty-desc">
                All visitors will route directly to the default destination: <code>{url.original_url}</code>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rules.map((rule, idx) => (
                <div key={rule.id} className="rule-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, background: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.8rem', color: 'var(--brand-primary)',
                    }}>
                      #{idx + 1}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--brand-primary)', textTransform: 'capitalize' }}>
                          {rule.rule_type === 'device' ? <><Smartphone size={11} /> {rule.match_value}</> : <><Clock size={11} /> {rule.match_value} ({rule.timezone})</>}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          routes to:
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: 2, wordBreak: 'break-all' }}>
                        {rule.destination_url}
                      </div>
                    </div>
                  </div>

                  <button
                    className="copy-btn"
                    onClick={() => handleDeleteRule(rule.id)}
                    title="Remove rule"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Deterministic Fallback card */}
          <div className="card" style={{ padding: '16px 20px', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={18} color="#10b981" />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Deterministic Fallback Path</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  If no rule matches a visitor's attributes, Axly safely forwards to <code>{url.original_url}</code> preserving all UTM queries.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: A/B Experiments */}
      {activeTab === 'experiments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>A/B Split Test Experiments</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Split traffic between multiple destination landing pages to maximize conversion.
              </p>
            </div>
            {!experiment && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreateExp(true)}>
                <Plus size={15} /> Create Experiment
              </button>
            )}
          </div>

          {showCreateExp && (
            <div className="card" style={{ padding: '24px', border: '1px solid var(--brand-primary)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>Configure A/B Split Test</h3>
              <form onSubmit={handleCreateExperiment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Experiment Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={expForm.name}
                      onChange={e => setExpForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conversion Goal Identifier</label>
                    <input
                      type="text"
                      className="form-input"
                      value={expForm.conversionGoal}
                      onChange={e => setExpForm(p => ({ ...p, conversionGoal: e.target.value }))}
                      placeholder="e.g. signup_completed, order_placed"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="form-label">Variants & Traffic Split (Sum must equal 100%)</div>
                  {expForm.variants.map((variant, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', gap: 10, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={variant.name}
                        onChange={e => {
                          const val = e.target.value;
                          setExpForm(p => ({
                            ...p,
                            variants: p.variants.map((v, idx) => idx === i ? { ...v, name: val } : v),
                          }));
                        }}
                      />
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://example.com/variant"
                        value={variant.destinationUrl}
                        onChange={e => {
                          const val = e.target.value;
                          setExpForm(p => ({
                            ...p,
                            variants: p.variants.map((v, idx) => idx === i ? { ...v, destinationUrl: val } : v),
                          }));
                        }}
                        required
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          className="form-input"
                          min="1"
                          max="99"
                          value={variant.weight}
                          onChange={e => {
                            const val = e.target.value;
                            setExpForm(p => ({
                              ...p,
                              variants: p.variants.map((v, idx) => idx === i ? { ...v, weight: val } : v),
                            }));
                          }}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateExp(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Activate Experiment
                  </button>
                </div>
              </form>
            </div>
          )}

          {loadingExp ? (
            <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />
          ) : !experiment ? (
            <div className="empty-state card" style={{ padding: '40px' }}>
              <div className="empty-icon"><GitCompare size={28} style={{ color: 'var(--text-muted)' }} /></div>
              <div className="empty-title">No active A/B test on this link</div>
              <div className="empty-desc">
                Deploy split tests to compare copy, hero sections, and pricing designs safely.
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{experiment.name}</h3>
                    <span className="badge badge-active">{experiment.status}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Goal: <code>{experiment.conversion_goal}</code>
                  </div>
                </div>

                <button className="btn btn-secondary btn-sm" onClick={handleSimulateConversion} title="Simulate a conversion event">
                  <GitCompare size={13} style={{ marginRight: 4 }} /> Simulate Conversion Event
                </button>
              </div>

              {/* Variants table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {experiment.variants?.map(v => {
                  const clicks = parseInt(v.clicks || 0, 10);
                  const conversions = parseInt(v.conversions || 0, 10);
                  const rate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : '0.0';

                  return (
                    <div key={v.id} className="variant-row">
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{v.name} ({v.weight}%)</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                          {v.destination_url}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{clicks}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Clicks</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10b981' }}>{conversions}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Conversions</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--brand-primary)' }}>{rate}%</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Conv. Rate</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Modal */}
      {showQr && <QRModal urlId={id} onClose={() => setShowQr(false)} />}
    </div>
  );
}
