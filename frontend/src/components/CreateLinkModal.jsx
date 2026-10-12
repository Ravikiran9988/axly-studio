import { useState } from 'react';
import { X, Link2, Tag, Calendar, Shuffle, Check, Copy, ExternalLink } from 'lucide-react';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function CreateLinkModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    url: '',
    customAlias: '',
    title: '',
    expiresAt: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = { url: form.url.trim() };
      if (form.customAlias.trim()) payload.customAlias = form.customAlias.trim();
      if (form.title.trim()) payload.title = form.title.trim();
      if (form.expiresAt) payload.expiresAt = form.expiresAt;

      const res = await api.post('/urls', payload);
      setResult(res.data.data);
      toast.success('Short URL created! 🎉');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create short URL');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.short_url);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    if (result) onCreated();
    else onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>

        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>
            {result ? '🎉 Link Created!' : 'Create Short Link'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {result ? 'Your short link is ready to share.' : 'Paste a long URL to generate a short, trackable link.'}
          </p>
        </div>

        {result ? (
          /* Success State */
          <div>
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              marginBottom: 20,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Your short URL</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 16 }}>
                {result.short_url.replace(/^https?:\/\//, '')}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
                  {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                </button>
                <a href={result.short_url} target="_blank" rel="noopener noreferrer" className="copy-btn" style={{ padding: '8px 20px', fontSize: '0.875rem' }}>
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                Create Another
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleDone}>
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && <div className="alert alert-error">⚠️ {error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="create-url">
                <Link2 size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Long URL *
              </label>
              <input
                id="create-url"
                name="url"
                type="url"
                className="form-input"
                placeholder="https://example.com/very/long/url/here"
                value={form.url}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="create-alias">
                <Tag size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Custom Alias <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute', left: 14, fontSize: '0.875rem',
                  color: 'var(--text-muted)', whiteSpace: 'nowrap',
                }}>s.axly.in/</span>
                <input
                  id="create-alias"
                  name="customAlias"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 84 }}
                  placeholder="my-link"
                  value={form.customAlias}
                  onChange={handleChange}
                  pattern="[a-zA-Z0-9_-]{3,30}"
                  title="3-30 characters: letters, numbers, hyphens, underscores"
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                3-30 chars · letters, numbers, hyphens, underscores only
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="create-title">
                Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="create-title"
                name="title"
                type="text"
                className="form-input"
                placeholder="e.g. My Resume"
                value={form.title}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="create-expires">
                <Calendar size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                Expiration Date <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="create-expires"
                name="expiresAt"
                type="date"
                className="form-input"
                value={form.expiresAt}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                Cancel
              </button>
              <button
                id="create-submit"
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: 'center' }}
                disabled={loading}
              >
                {loading ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</>
                ) : (
                  <><Link2 size={16} /> Create Short Link</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
