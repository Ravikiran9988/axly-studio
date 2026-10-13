import { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import {
  Key, Webhook, Globe, Plus, Trash2, RotateCcw, Copy, Check,
  ExternalLink, AlertTriangle, ShieldCheck, RefreshCw, Send,
  Clock, CheckCircle2, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const SCOPES_OPTIONS = [
  { id: 'links:read', label: 'Read Links', desc: 'Query and list shortened links and aliases' },
  { id: 'links:write', label: 'Manage Links', desc: 'Create, edit, and delete shortened links' },
  { id: 'analytics:read', label: 'Read Analytics', desc: 'Retrieve click streams, geo, and device analytics' },
  { id: 'campaigns:read', label: 'Read Campaigns', desc: 'Inspect marketing campaigns & UTM templates' },
  { id: 'campaigns:write', label: 'Manage Campaigns', desc: 'Create & modify campaigns' },
  { id: 'experiments:read', label: 'Read Experiments', desc: 'Inspect A/B split tests' },
  { id: 'experiments:write', label: 'Manage Experiments', desc: 'Create & configure A/B experiments' },
  { id: 'webhooks:read', label: 'Read Webhooks', desc: 'Inspect webhook subscriptions and deliveries' },
  { id: 'webhooks:write', label: 'Manage Webhooks', desc: 'Register endpoints and retry deliveries' },
  { id: 'domains:read', label: 'Read Domains', desc: 'View custom branded domains' },
  { id: 'domains:write', label: 'Manage Domains', desc: 'Register and verify DNS records' },
];

const WEBHOOK_EVENTS = [
  { id: 'link.created', label: 'Link Created', desc: 'Fires when a new short link or alias is shortened' },
  { id: 'link.expired', label: 'Link Expired', desc: 'Fires when a link expires based on its TTL' },
  { id: 'link.health_changed', label: 'Health Status Changed', desc: 'Fires when target URL goes down or recovers' },
  { id: 'experiment.completed', label: 'Experiment Completed', desc: 'Fires when an A/B test concludes' },
];

export default function DeveloperPage() {
  const [tab, setTab] = useState('keys'); // 'keys' | 'webhooks' | 'domains'
  const [loading, setLoading] = useState(true);

  // API Keys State
  const [apiKeys, setApiKeys] = useState([]);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    scopes: ['links:read', 'links:write'],
    rateLimitPerMinute: 60,
    expiresInDays: 90,
  });
  const [revealedKey, setRevealedKey] = useState(null);

  // Webhooks State
  const [webhooks, setWebhooks] = useState([]);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [newWebhookForm, setNewWebhookForm] = useState({
    url: '',
    events: ['link.created'],
  });
  const [revealedWebhookSecret, setRevealedWebhookSecret] = useState(null);
  const [deliveriesModalWebhook, setDeliveriesModalWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // Domains State
  const [domains, setDomains] = useState([]);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [newDomainForm, setNewDomainForm] = useState({ domain: '' });
  const [verifyingDomainId, setVerifyingDomainId] = useState(null);

  const [copiedText, setCopiedText] = useState('');

  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`${label} to clipboard!`);
    setTimeout(() => setCopiedText(''), 3000);
  };

  // Load active tab data
  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'keys') {
        const res = await api.get('/keys');
        setApiKeys(res.data.apiKeys || res.data.data || []);
      } else if (tab === 'webhooks') {
        const res = await api.get('/webhooks');
        setWebhooks(res.data.data || []);
      } else if (tab === 'domains') {
        const res = await api.get('/domains');
        setDomains(res.data.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load developer resources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  // Handle Create API Key
  const handleCreateKey = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/keys', newKeyForm);
      const created = res.data.apiKey || res.data.data;
      setRevealedKey(created.key);
      setKeyModalOpen(false);
      setNewKeyForm({ name: '', scopes: ['links:read', 'links:write'], rateLimitPerMinute: 60, expiresInDays: 90 });
      loadData();
      toast.success('API key generated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create API key.');
    }
  };

  // Handle Revoke API Key
  const handleRevokeKey = async (id, name) => {
    if (!confirm(`Are you sure you want to revoke API key "${name}"? Any service using this key will immediately lose access.`)) return;
    try {
      await api.delete(`/keys/${id}`);
      toast.success('API key revoked.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke API key.');
    }
  };

  // Handle Create Webhook
  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/webhooks', newWebhookForm);
      const created = res.data.webhook || res.data.data;
      setRevealedWebhookSecret(created.secret);
      setWebhookModalOpen(false);
      setNewWebhookForm({ url: '', events: ['link.created'] });
      loadData();
      toast.success('Webhook registered successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register webhook.');
    }
  };

  // Load deliveries
  const openDeliveriesModal = async (webhook) => {
    setDeliveriesModalWebhook(webhook);
    setLoadingDeliveries(true);
    try {
      const res = await api.get(`/webhooks/${webhook.id}/deliveries`);
      setDeliveries(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load webhook delivery history.');
    } finally {
      setLoadingDeliveries(false);
    }
  };

  // Retry delivery
  const handleRetryDelivery = async (webhookId, deliveryId) => {
    try {
      await api.post(`/webhooks/${webhookId}/deliveries/${deliveryId}/retry`);
      toast.success('Redelivery triggered!');
      openDeliveriesModal(deliveriesModalWebhook);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Retry failed.');
    }
  };

  // Rotate Webhook Secret
  const handleRotateWebhookSecret = async (id) => {
    if (!confirm('Rotate this webhook signing secret? You will need to update signature verification on your receiving endpoint.')) return;
    try {
      const res = await api.post(`/webhooks/${id}/rotate-secret`);
      setRevealedWebhookSecret(res.data.secret);
      toast.success('Webhook signing secret rotated.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rotate secret.');
    }
  };

  // Delete Webhook
  const handleDeleteWebhook = async (id) => {
    if (!confirm('Delete this webhook endpoint subscription?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      toast.success('Webhook removed.');
      loadData();
    } catch (err) {
      toast.error('Failed to delete webhook.');
    }
  };

  // Handle Create Custom Domain
  const handleCreateDomain = async (e) => {
    e.preventDefault();
    try {
      await api.post('/domains', newDomainForm);
      setDomainModalOpen(false);
      setNewDomainForm({ domain: '' });
      loadData();
      toast.success('Custom domain registered. Configure DNS to verify ownership.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register domain.');
    }
  };

  // Handle Verify Domain DNS Probe
  const handleVerifyDomain = async (id, domainName) => {
    setVerifyingDomainId(id);
    try {
      const res = await api.post(`/domains/${id}/verify`);
      toast.success(res.data.message || `Domain '${domainName}' activated!`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.reason || err.response?.data?.message || 'DNS verification failed.');
    } finally {
      setVerifyingDomainId(null);
    }
  };

  // Delete Domain
  const handleDeleteDomain = async (id, domainName) => {
    if (!confirm(`Remove custom domain "${domainName}"? Short links using this domain will fall back to default short domain.`)) return;
    try {
      await api.delete(`/domains/${id}`);
      toast.success('Domain removed.');
      loadData();
    } catch (err) {
      toast.error('Failed to remove domain.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Developer Platform</h1>
          <p className="page-subtitle">Programmatic API keys, signed event webhooks, and branded domains</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        <button
          onClick={() => setTab('keys')}
          className={`tab-btn ${tab === 'keys' ? 'active' : ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px',
            background: 'none', border: 'none', borderBottom: tab === 'keys' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: tab === 'keys' ? 'var(--brand-primary)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
          }}
        >
          <Key size={16} /> API Keys
        </button>
        <button
          onClick={() => setTab('webhooks')}
          className={`tab-btn ${tab === 'webhooks' ? 'active' : ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px',
            background: 'none', border: 'none', borderBottom: tab === 'webhooks' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: tab === 'webhooks' ? 'var(--brand-primary)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
          }}
        >
          <Webhook size={16} /> Webhooks & Events
        </button>
        <button
          onClick={() => setTab('domains')}
          className={`tab-btn ${tab === 'domains' ? 'active' : ''}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px',
            background: 'none', border: 'none', borderBottom: tab === 'domains' ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: tab === 'domains' ? 'var(--brand-primary)' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
          }}
        >
          <Globe size={16} /> Branded Domains
        </button>
      </div>

      {/* One-Time Revealed Secret Alerts */}
      {revealedKey && (
        <div className="card" style={{ background: 'rgba(16,185,129,0.06)', borderColor: '#10b981', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#10b981', fontWeight: 600, marginBottom: 8 }}>
            <ShieldCheck size={20} /> New API Key Generated
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            Copy this key now. For your security, this full secret will never be displayed again.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <code style={{ fontSize: '0.9rem', color: 'var(--brand-primary)', flex: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {revealedKey}
            </code>
            <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(revealedKey, 'API Key copied')}>
              {copiedText === revealedKey ? <Check size={14} /> : <Copy size={14} />} Copy
            </button>
          </div>
          <button className="btn btn-sm btn-outline" style={{ marginTop: 12 }} onClick={() => setRevealedKey(null)}>
            I have securely saved this key
          </button>
        </div>
      )}

      {revealedWebhookSecret && (
        <div className="card" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'var(--brand-primary)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand-primary)', fontWeight: 600, marginBottom: 8 }}>
            <ShieldCheck size={20} /> Webhook Signing Secret
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            Use this secret to verify HMAC-SHA256 signatures on incoming payloads via the <code>x-axly-signature</code> header.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <code style={{ fontSize: '0.9rem', color: 'var(--brand-primary)', flex: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {revealedWebhookSecret}
            </code>
            <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(revealedWebhookSecret, 'Secret copied')}>
              {copiedText === revealedWebhookSecret ? <Check size={14} /> : <Copy size={14} />} Copy
            </button>
          </div>
          <button className="btn btn-sm btn-outline" style={{ marginTop: 12 }} onClick={() => setRevealedWebhookSecret(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: API KEYS */}
      {tab === 'keys' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Active API Keys</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Authenticate programmatic requests with scoped tokens</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setKeyModalOpen(true)} id="btn-create-api-key">
              <Plus size={16} /> Generate API Key
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <Key size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h4>No API keys found</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Create an API key to integrate Axly into your build pipelines, CLI tools, or external services.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setKeyModalOpen(true)}>Generate Key</button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Key Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Prefix</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Scopes</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Rate Limit</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Used</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map(k => (
                    <tr key={k.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                        {k.name}
                        {k.is_revoked && <span className="badge" style={{ marginLeft: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Revoked</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <code style={{ fontSize: '0.8rem', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4 }}>
                          {k.key_prefix}...
                        </code>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(k.scopes || []).map(s => (
                            <span key={s} className="badge" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{s}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {k.rate_limit_per_minute}/min
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {!k.is_revoked && (
                          <button
                            className="btn btn-sm"
                            style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                            onClick={() => handleRevokeKey(k.id, k.name)}
                            title="Revoke Key"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEBHOOKS */}
      {tab === 'webhooks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Webhooks & Events</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Subscribe to async link events with HMAC-SHA256 signed payloads</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setWebhookModalOpen(true)} id="btn-register-webhook">
              <Plus size={16} /> Register Endpoint
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <Webhook size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h4>No webhooks registered</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Register an HTTPS endpoint to receive link creation, expiration, and uptime events in real-time.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setWebhookModalOpen(true)}>Register Webhook</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {webhooks.map(wh => (
                <div key={wh.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="badge" style={{ background: wh.is_active ? 'rgba(16,185,129,0.1)' : 'var(--bg-input)', color: wh.is_active ? '#10b981' : 'var(--text-muted)' }}>
                        {wh.is_active ? '● Active' : '○ Inactive'}
                      </span>
                      <code style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {wh.url}
                      </code>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openDeliveriesModal(wh)}>
                        <Clock size={14} /> Deliveries Log
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRotateWebhookSecret(wh.id)} title="Rotate Secret">
                        <RotateCcw size={14} /> Rotate Secret
                      </button>
                      <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteWebhook(wh.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subscribed Events:</span>
                    {(wh.events || []).map(e => (
                      <span key={e} className="badge" style={{ fontSize: '0.7rem' }}>{e}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CUSTOM DOMAINS */}
      {tab === 'domains' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Custom Branded Domains</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shorten links using your own branded root domain or subdomain</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setDomainModalOpen(true)} id="btn-add-custom-domain">
              <Plus size={16} /> Add Custom Domain
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading domains...</div>
          ) : domains.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <Globe size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <h4>No custom domains configured</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>Add a domain (like <code>links.mybrand.com</code>) to replace the default <code>s.axly.in</code> domain.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setDomainModalOpen(true)}>Add Domain</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {domains.map(d => (
                <div key={d.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h4 style={{ fontSize: '1.05rem', margin: 0 }}>{d.domain}</h4>
                        <span className={`badge ${d.status === 'active' ? 'badge-active' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {d.status === 'active' ? (
                            <><CheckCircle2 size={12} /> Verified & Active</>
                          ) : (
                            <><Clock size={12} /> Pending DNS</>
                          )}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {d.status === 'active' ? `Verified on ${new Date(d.verified_at).toLocaleDateString()}` : 'Awaiting DNS configuration'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {d.status !== 'active' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleVerifyDomain(d.id, d.domain)}
                          disabled={verifyingDomainId === d.id}
                        >
                          <RefreshCw size={14} className={verifyingDomainId === d.id ? 'spin' : ''} />
                          {verifyingDomainId === d.id ? 'Checking DNS...' : 'Verify DNS'}
                        </button>
                      )}
                      <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteDomain(d.id, d.domain)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {d.status !== 'active' && (
                    <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Required DNS Records:</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ color: 'var(--text-muted)' }}>
                            <th style={{ paddingBottom: 6 }}>Type</th>
                            <th style={{ paddingBottom: 6 }}>Host / Name</th>
                            <th style={{ paddingBottom: 6 }}>Target / Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>CNAME</td>
                            <td><code>{d.domain}</code></td>
                            <td><code>cname.axly.in</code></td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>TXT</td>
                            <td><code>_axly-verify.{d.domain}</code></td>
                            <td><code>{d.verification_token}</code></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE API KEY MODAL */}
      {keyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: 16 }}>Generate API Key</h3>
            <form onSubmit={handleCreateKey} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Key Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CI/CD Link Publisher"
                  value={newKeyForm.name}
                  onChange={e => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Key Scopes</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                  {SCOPES_OPTIONS.map(sc => {
                    const checked = newKeyForm.scopes.includes(sc.id);
                    return (
                      <label key={sc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setNewKeyForm({ ...newKeyForm, scopes: newKeyForm.scopes.filter(s => s !== sc.id) });
                            } else {
                              setNewKeyForm({ ...newKeyForm, scopes: [...newKeyForm.scopes, sc.id] });
                            }
                          }}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{sc.label} <code>({sc.id})</code></div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{sc.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Rate Limit (/min)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newKeyForm.rateLimitPerMinute}
                    onChange={e => setNewKeyForm({ ...newKeyForm, rateLimitPerMinute: parseInt(e.target.value, 10) || 60 })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry (Days)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newKeyForm.expiresInDays}
                    onChange={e => setNewKeyForm({ ...newKeyForm, expiresInDays: parseInt(e.target.value, 10) || 90 })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setKeyModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Secret</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE WEBHOOK MODAL */}
      {webhookModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: 16 }}>Register Webhook Endpoint</h3>
            <form onSubmit={handleCreateWebhook} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Payload URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://api.mybrand.com/webhooks/axly"
                  value={newWebhookForm.url}
                  onChange={e => setNewWebhookForm({ ...newWebhookForm, url: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Must be a publicly accessible HTTPS destination. Private IPs and cloud metadata addresses are restricted by SSRF policy.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Events to Receive</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {WEBHOOK_EVENTS.map(ev => {
                    const checked = newWebhookForm.events.includes(ev.id);
                    return (
                      <label key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setNewWebhookForm({ ...newWebhookForm, events: newWebhookForm.events.filter(e => e !== ev.id) });
                            } else {
                              setNewWebhookForm({ ...newWebhookForm, events: [...newWebhookForm.events, ev.id] });
                            }
                          }}
                          style={{ marginTop: 3 }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{ev.label} <code>({ev.id})</code></div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{ev.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setWebhookModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Subscribe</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DOMAIN MODAL */}
      {domainModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: 16 }}>Add Custom Short Domain</h3>
            <form onSubmit={handleCreateDomain} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Domain Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. links.mybrand.com"
                  value={newDomainForm.domain}
                  onChange={e => setNewDomainForm({ domain: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Enter the exact FQDN you wish to use for branded short links.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDomainModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Domain</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEBHOOK DELIVERIES DRAWER / MODAL */}
      {deliveriesModalWebhook && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Webhook Delivery Log</h3>
                <code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{deliveriesModalWebhook.url}</code>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeliveriesModalWebhook(null)}>Close</button>
            </div>

            {loadingDeliveries ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading delivery logs...</div>
            ) : deliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No deliveries recorded yet. Events will appear here once fired.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
                {deliveries.map(del => (
                  <div key={del.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge" style={{ background: del.is_success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: del.is_success ? '#10b981' : 'var(--danger)' }}>
                          {del.status_code ? `HTTP ${del.status_code}` : 'ERROR'}
                        </span>
                        <span style={{ fontWeight: 600 }}>{del.event}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{del.duration_ms}ms</span>
                      </div>
                      {del.error_reason && (
                        <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: 4 }}>
                          {del.error_reason}
                        </div>
                      )}
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRetryDelivery(deliveriesModalWebhook.id, del.id)}
                    >
                      <RotateCcw size={12} /> Retry
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
