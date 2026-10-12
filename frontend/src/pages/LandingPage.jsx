import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link2, Zap, BarChart3, QrCode, Shield, Globe, ArrowRight, Moon, Sun, Copy, Check, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth, api } from '../context/AuthContext';
import toast from 'react-hot-toast';

const FEATURES = [
  {
    icon: '⚡',
    color: 'rgba(245, 158, 11, 0.15)',
    title: 'Fast Redirects',
    desc: 'Lightweight, optimized HTTP redirects with minimal overhead to route your visitors instantly.'
  },
  {
    icon: '📊',
    color: 'rgba(124, 58, 237, 0.15)',
    title: 'Click Analytics',
    desc: 'Track total clicks, unique visitors, devices, operating systems, browsers, and top referrers.'
  },
  {
    icon: '🔒',
    color: 'rgba(16, 185, 129, 0.15)',
    title: 'Privacy-First Tracking',
    desc: 'Cryptographic visitor hashing ensures deduplication without indefinitely persisting invasive PII.'
  },
  {
    icon: '🎨',
    color: 'rgba(236, 72, 153, 0.15)',
    title: 'Custom Aliases',
    desc: 'Create memorable, customized vanity links like s.axly.in/launch for branding and campaigns.'
  },
  {
    icon: '📱',
    color: 'rgba(6, 182, 212, 0.15)',
    title: 'QR Code Generator',
    desc: 'Generate downloadable high-resolution QR codes for any short link, perfect for print and presentations.'
  },
  {
    icon: '⏰',
    color: 'rgba(79, 70, 229, 0.15)',
    title: 'Link Expiration & Toggling',
    desc: 'Set automatic expiration timestamps or temporarily disable links anytime with one-click toggles.'
  },
];

const ARCHITECTURE_HIGHLIGHTS = [
  { value: 'PostgreSQL', label: 'Reliable ACID Storage' },
  { value: 'Supabase', label: 'Cloud DB Ready' },
  { value: 'Docker', label: 'Production Compose' },
  { value: 'JWT + bcrypt', label: 'Secure Auth' },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleShorten = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/urls', { url: url.trim() });
      setResult(res.data.data);
      toast.success('Short URL created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to shorten URL');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.short_url);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="landing-hero">
      {/* Background Orbs */}
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="grid-overlay" />
      </div>

      {/* Navbar */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <div className="logo-icon"><Link2 size={18} /></div>
          <span>Axly</span>
        </div>

        <div className="nav-actions">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard <ArrowRight size={15} />
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Log in</Link>
              <Link to="/register" className="btn btn-primary">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="hero-content">
        <div className="hero-badge">
          <span className="badge-dot" />
          <span>Modern Link Shortener & Analytics</span>
        </div>

        <h1 className="hero-title">
          Shorten links.<br />
          <span className="gradient-text">Understand every click.</span>
        </h1>

        <p className="hero-subtitle">
          Axly helps you build clean short links, generate QR codes, protect campaigns with expiration dates, and monitor visitor traffic with deep privacy-first analytics.
        </p>

        {/* Shortener Form */}
        <div className="shorten-box">
          <form onSubmit={handleShorten} className="shorten-form">
            <input
              id="landing-url-input"
              type="url"
              className="shorten-input"
              placeholder="Paste a long URL here (e.g. https://example.com/very/long/url)..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <button
              id="shorten-submit-btn"
              type="submit"
              className="btn btn-primary shorten-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              ) : (
                <>Shorten <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {/* Result Card */}
          {result && (
            <div className="shorten-result">
              <div className="result-left">
                <span className="result-label">Your shortened link:</span>
                <a
                  href={result.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-short"
                  id="result-short-link"
                >
                  {result.short_url}
                </a>
              </div>
              <div className="result-actions">
                <button
                  id="copy-short-btn"
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
                <a
                  href={result.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="copy-btn"
                >
                  <ExternalLink size={14} /> Open
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Architecture & Tech Badges */}
        <div className="stats-row">
          {ARCHITECTURE_HIGHLIGHTS.map(item => (
            <div className="stat-item" key={item.label}>
              <div className="stat-number">{item.value}</div>
              <div className="stat-desc">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Everything you need to manage your links</h2>
          <p className="section-subtitle">Powerful tools built for creators, marketers, and developers.</p>
        </div>

        <div className="features-grid">
          {FEATURES.map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon" style={{ background: f.color }}>
                {f.icon}
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon"><Link2 size={16} /></div>
            <span>Axly URL Shortener</span>
          </div>
          <p className="footer-copy">© 2026 Axly. Built for performance, security, and privacy.</p>
        </div>
      </footer>
    </div>
  );
}
