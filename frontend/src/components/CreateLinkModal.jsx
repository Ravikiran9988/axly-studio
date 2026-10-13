import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Link2, Sparkles, SlidersHorizontal, Calendar, Check, Copy, ExternalLink, AlertCircle, QrCode } from 'lucide-react';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function CreateLinkModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [aliasMode, setAliasMode] = useState('auto'); // 'auto' | 'custom'
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

  // Determine short link domain dynamically
  const shortDomain = window.location.hostname.includes('axly.in') 
    ? 's.axly.in' 
    : window.location.host;

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const trimmedUrl = form.url.trim();
    if (!trimmedUrl) {
      setError('Enter a valid destination URL.');
      setLoading(false);
      return;
    }

    try {
      const payload = { url: trimmedUrl };
      if (aliasMode === 'custom' && form.customAlias.trim()) {
        payload.customAlias = form.customAlias.trim();
      }
      if (form.title.trim()) payload.title = form.title.trim();
      if (form.expiresAt) payload.expiresAt = form.expiresAt;

      const res = await api.post('/urls', payload);
      setResult(res.data.data);
      toast.success('Your short link is ready to copy and share.');
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('already taken') || msg.toLowerCase().includes('in use') || msg.toLowerCase().includes('duplicate')) {
        setError('This alias is already taken. Try another one.');
      } else if (msg.toLowerCase().includes('alias') || msg.toLowerCase().includes('characters')) {
        setError('Use letters, numbers, and the supported characters (hyphens and underscores).');
      } else if (msg.toLowerCase().includes('valid url') || msg.toLowerCase().includes('invalid')) {
        setError('Enter a valid destination URL.');
      } else {
        setError(msg || 'Failed to create short URL. Please check your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.short_url) return;
    await navigator.clipboard.writeText(result.short_url);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenQrGenerator = () => {
    if (result?.short_url) {
      if (onCreated) onCreated();
      navigate(`/app/qr?url=${encodeURIComponent(result.short_url)}`);
    }
  };

  const handleDone = () => {
    if (result) onCreated();
    else onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>
            {result ? 'Your Short Link is Ready' : 'Shorten a Link'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {result 
              ? 'Your short link is ready to copy and share.' 
              : 'Paste your destination URL and optionally personalize its short ending.'}
          </p>
        </div>

        {result ? (
          /* Success State */
          <div>
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              marginBottom: 20,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Your short link</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 8, wordBreak: 'break-all' }}>
                {result.short_url.replace(/^https?:\/\//, '')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Opens: {result.original_url}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
                  {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy link</>}
                </button>
                <a href={result.short_url} target="_blank" rel="noopener noreferrer" className="copy-btn" style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
                  <ExternalLink size={14} /> Open link
                </a>
                <button className="copy-btn" onClick={handleOpenQrGenerator} style={{ padding: '8px 18px', fontSize: '0.875rem' }} title="Generate styled QR code">
                  <QrCode size={14} /> QR Code
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setResult(null); setForm({ url: '', customAlias: '', title: '', expiresAt: '' }); }}>
                Shorten Another
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleDone}>
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Link Creation Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && (
              <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Destination URL */}
            <div className="form-group">
              <label className="form-label" htmlFor="create-url" style={{ fontWeight: 600 }}>
                Where should your link open? *
              </label>
              <input
                id="create-url"
                name="url"
                type="url"
                className="form-input"
                placeholder="https://example.com/products/summer-sale"
                value={form.url}
                onChange={handleChange}
                required
                autoFocus
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Paste the full destination web address you want visitors to reach.
              </div>
            </div>

            {/* Link Ending Choice: Auto vs Custom */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Short link ending
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => setAliasMode('auto')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid ' + (aliasMode === 'auto' ? 'var(--brand-primary)' : 'var(--border-color)'),
                    background: aliasMode === 'auto' ? 'rgba(37,99,235,0.06)' : 'var(--bg-secondary)',
                    color: aliasMode === 'auto' ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontWeight: aliasMode === 'auto' ? 600 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={14} /> Generate automatically
                </button>
                <button
                  type="button"
                  onClick={() => setAliasMode('custom')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid ' + (aliasMode === 'custom' ? 'var(--brand-primary)' : 'var(--border-color)'),
                    background: aliasMode === 'custom' ? 'rgba(37,99,235,0.06)' : 'var(--bg-secondary)',
                    color: aliasMode === 'custom' ? 'var(--brand-primary)' : 'var(--text-primary)',
                    fontWeight: aliasMode === 'custom' ? 600 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <SlidersHorizontal size={14} /> Customize link
                </button>
              </div>

              {aliasMode === 'custom' ? (
                <div>
                  <label className="form-label" htmlFor="create-alias" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Choose the ending of your short link
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      position: 'absolute', left: 14, fontSize: '0.875rem',
                      color: 'var(--text-muted)', whiteSpace: 'nowrap',
                    }}>{shortDomain}/</span>
                    <input
                      id="create-alias"
                      name="customAlias"
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: `${shortDomain.length * 8.5 + 24}px` }}
                      placeholder="summer-sale"
                      value={form.customAlias}
                      onChange={handleChange}
                      pattern="[a-zA-Z0-9_-]{3,30}"
                      title="Use letters, numbers, hyphens, and underscores (3-30 characters)"
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Personalize your link so it is easier to recognize and share. Leave empty to generate one automatically.
                  </div>

                  {/* Live-style URL preview */}
                  <div style={{
                    marginTop: 8,
                    padding: '6px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}>
                    Your short link preview: <strong style={{ color: 'var(--brand-primary)' }}>{shortDomain}/{form.customAlias.trim() || 'your-alias'}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Axly will create a clean, short code automatically (e.g. <code>{shortDomain}/x8k2q</code>).
                </div>
              )}
            </div>

            {/* Optional Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="create-title">
                Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="create-title"
                name="title"
                type="text"
                className="form-input"
                placeholder="e.g. Summer Campaign Landing Page"
                value={form.title}
                onChange={handleChange}
              />
            </div>

            {/* Optional Expiration Date */}
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

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
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
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Shortening...</>
                ) : (
                  <><Link2 size={16} /> Shorten URL</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
