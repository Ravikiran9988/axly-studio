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
    title: 'Lightning Fast',
    desc: 'Sub-millisecond redirects powered by optimized caching. Your links load instantly, every time.'
  },
  {
    icon: '📊',
    color: 'rgba(124, 58, 237, 0.15)',
    title: 'Deep Analytics',
    desc: 'Track clicks, countries, devices, browsers, and referrers. Understand your audience like never before.'
  },
  {
    icon: '🔒',
    color: 'rgba(16, 185, 129, 0.15)',
    title: 'Secure & Reliable',
    desc: 'All links are scanned for malicious content. 99.9% uptime guarantee with enterprise-grade security.'
  },
  {
    icon: '🎨',
    color: 'rgba(236, 72, 153, 0.15)',
    title: 'Custom Aliases',
    desc: 'Create memorable short links like s.axly.in/my-resume instead of random characters.'
  },
  {
    icon: '📱',
    color: 'rgba(6, 182, 212, 0.15)',
    title: 'QR Code Generator',
    desc: 'Instantly generate beautiful QR codes for any of your short links. Perfect for print media.'
  },
  {
    icon: '⏰',
    color: 'rgba(79, 70, 229, 0.15)',
    title: 'Link Expiration',
    desc: 'Set expiration dates for time-sensitive campaigns. Links auto-disable when they expire.'
  },
];

const STATS = [
  { value: '10M+', label: 'Links Created' },
  { value: '500M+', label: 'Clicks Tracked' },
  { value: '99.9%', label: 'Uptime' },
  { value: '150+', label: 'Countries' },
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
      {/* Background */}
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="grid-overlay" />
      </div>

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-icon">A</div>
          <span className="gradient-text">Axly</span>
        </div>
        <div className="navbar-actions">
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
              Dashboard <ArrowRight size={15} />
            </button>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Get Started <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Content */}
      <div className="hero-content">
        <div className="hero-badge">
          <Zap size={14} />
          <span>Now with Advanced Analytics</span>
        </div>

        <h1 className="hero-title">
          Shorten, Share &<br />
          <span className="gradient-text">Track Every Click</span>
        </h1>

        <p className="hero-subtitle">
          Transform long URLs into powerful short links with real-time analytics,
          custom aliases, QR codes, and enterprise-grade security.
        </p>

        {/* Shorten Box */}
        <div className="shorten-box">
          <form onSubmit={handleShorten}>
            <div className="shorten-input-wrap">
              <input
                id="url-input"
                type="url"
                className="shorten-input"
                placeholder="Paste your long URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <button type="submit" className="shorten-btn" disabled={loading}>
                {loading ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Shortening...</>
                ) : (
                  <><Link2 size={16} /> Shorten URL</>
                )}
              </button>
            </div>
          </form>

          {result && (
            <div className="result-box">
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Your short link:</div>
                <a
                  href={result.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-short-url"
                >
                  {result.short_url}
                </a>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                  {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
                <a href={result.short_url} target="_blank" rel="noopener noreferrer" className="copy-btn">
                  <ExternalLink size={13} /> Open
                </a>
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Free to use · No account required for basic shortening ·{' '}
            <Link to="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
              Sign up for analytics →
            </Link>
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(0,0,0,0.2)',
        backdropFilter: 'blur(10px)',
        padding: '24px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '24px',
          maxWidth: '900px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}
                className="gradient-text">{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="features-section">
        <div style={{ textAlign: 'center', marginBottom: '52px' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: '16px' }}>
            Everything you need to{' '}
            <span className="gradient-text">manage your links</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '540px', margin: '0 auto' }}>
            From simple URL shortening to enterprise-grade link management — Axly has you covered.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon" style={{ background: f.color, fontSize: '1.5rem' }}>
                {f.icon}
              </div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div style={{
        padding: '80px 24px',
        textAlign: 'center',
        position: 'relative',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(124, 58, 237, 0.03)',
      }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: '16px' }}>
          Ready to supercharge your links?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '36px', fontSize: '1.05rem' }}>
          Join thousands of creators, marketers, and developers using Axly.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary btn-lg">
            Start for Free <ArrowRight size={18} />
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Sign In
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        padding: '24px',
        textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <div className="logo-icon" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>A</div>
          <span className="gradient-text" style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>Axly</span>
        </div>
        <p>© 2026 Axly · url.axly.in · Built with ❤️</p>
      </footer>
    </div>
  );
}
