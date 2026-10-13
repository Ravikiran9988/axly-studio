import { useState, useEffect, useCallback } from 'react';
import {
  GitCompare, Plus, Play, Pause, CheckCircle2,
  TrendingUp, ExternalLink, BarChart3, AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState([]);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form State
  const [form, setForm] = useState({
    urlId: '',
    name: 'Homepage Hero CTA Experiment',
    conversionGoal: 'signup_completed',
    variants: [
      { name: 'Variant A (Original)', destinationUrl: '', weight: 50 },
      { name: 'Variant B (Challenger)', destinationUrl: '', weight: 50 },
    ],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, urlRes] = await Promise.all([
        api.get('/experiments'),
        api.get('/urls?limit=100'),
      ]);
      setExperiments(expRes.data.data || []);
      setUrls(urlRes.data.data || []);
      if (urlRes.data.data?.length > 0 && !form.urlId) {
        setForm(p => ({ ...p, urlId: urlRes.data.data[0].id }));
      }
    } catch {
      toast.error('Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const sum = form.variants.reduce((s, v) => s + parseInt(v.weight || 0, 10), 0);
    if (sum !== 100) {
      toast.error(`Variant weights must sum up to 100% (currently ${sum}%)`);
      return;
    }

    try {
      const payload = {
        urlId: form.urlId,
        name: form.name.trim(),
        conversionGoal: form.conversionGoal.trim(),
        variants: form.variants.map(v => ({
          name: v.name.trim(),
          destinationUrl: v.destinationUrl.trim(),
          weight: parseInt(v.weight, 10),
        })),
      };

      await api.post('/experiments', payload);
      toast.success('A/B Experiment launched successfully.');
      setShowCreate(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create experiment');
    }
  };

  const handleSimulateConversion = async (expId) => {
    try {
      await api.post(`/experiments/${expId}/convert`, {
        visitorHash: `test-agent-${Date.now()}`,
        value: 1,
      });
      toast.success('Test conversion event recorded!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Conversion tracking error');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">A/B Experiments & Conversion Engine</h1>
          <p className="page-subtitle">
            Deploy deterministic multi-variant traffic splits with real conversion tracking and statistical metrics
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Experiment
        </button>
      </div>

      {/* Creation Modal */}
      {showCreate && (
        <div className="card" style={{ padding: '24px', marginBottom: 28, border: '1px solid var(--brand-primary)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Create A/B Traffic Experiment</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Divide visitor traffic probabilistically between landing page variations.
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Close</button>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Link to Split Test *</label>
                <select
                  className="form-input"
                  value={form.urlId}
                  onChange={e => setForm(p => ({ ...p, urlId: e.target.value }))}
                  required
                >
                  {urls.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.title ? `${u.title} (${u.short_code})` : u.short_url}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Experiment Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Conversion Goal Identifier *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. signup_completed, trial_started"
                  value={form.conversionGoal}
                  onChange={e => setForm(p => ({ ...p, conversionGoal: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="form-label">Destination Variants (Weights must sum to 100%)</label>
              {form.variants.map((v, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={v.name}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(p => ({
                        ...p,
                        variants: p.variants.map((varItem, idx) => idx === i ? { ...varItem, name: val } : varItem),
                      }));
                    }}
                    required
                  />
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com/landing-page"
                    value={v.destinationUrl}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(p => ({
                        ...p,
                        variants: p.variants.map((varItem, idx) => idx === i ? { ...varItem, destinationUrl: val } : varItem),
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
                      value={v.weight}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(p => ({
                          ...p,
                          variants: p.variants.map((varItem, idx) => idx === i ? { ...varItem, weight: val } : varItem),
                        }));
                      }}
                      required
                    />
                    <span>%</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Start Experiment</button>
            </div>
          </form>
        </div>
      )}

      {/* Experiments List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />)}
        </div>
      ) : experiments.length === 0 ? (
        <div className="empty-state card" style={{ padding: '48px' }}>
          <div className="empty-icon"><GitCompare size={28} style={{ color: 'var(--text-muted)' }} /></div>
          <div className="empty-title">No A/B experiments running yet</div>
          <div className="empty-desc">
            Test and validate conversion improvements scientifically across different destination landing pages.
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Launch first A/B experiment
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {experiments.map(exp => (
            <div key={exp.id} className="experiment-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{exp.name}</h3>
                    <span className="badge badge-active">{exp.status}</span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    Goal: <code>{exp.conversion_goal}</code> · Linked Short Code: <strong>{exp.short_code}</strong>
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSimulateConversion(exp.id)}
                  title="Fire test conversion"
                >
                  <GitCompare size={13} style={{ marginRight: 4 }} /> Simulate Conversion
                </button>
              </div>

              {/* Variants Progress & Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {exp.variants?.map(v => {
                  const clicks = parseInt(v.clicks || 0, 10);
                  const conversions = parseInt(v.conversions || 0, 10);
                  const convRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : '0.0';

                  return (
                    <div key={v.id} className="variant-row">
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                          {v.name} ({v.weight}% weight)
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                          {v.destination_url}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 28, textAlign: 'right' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>{clicks}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Clicks</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#10b981' }}>{conversions}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Conversions</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--brand-primary)' }}>{convRate}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Conv. Rate</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
