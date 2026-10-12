import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Link2, ArrowRight, Moon, Sun, Copy, Check, ExternalLink, 
  ShieldCheck, Zap, BarChart2, Globe, Sparkles, QrCode, Lock,
  CheckCircle2, XCircle, ShieldAlert
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth, api } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';
import toast from 'react-hot-toast';

const COMPARISON_FEATURES = [
  { feature: 'Instant URL Shortening', guest: true, account: true },
  { feature: 'High-Speed HTTP 302 Redirects', guest: true, account: true },
  { feature: 'Standard QR Code Preview', guest: true, account: true },
  { feature: 'Custom Vanity Aliases (e.g. /launch)', guest: false, account: true },
  { feature: 'Link Expiration Timers & Toggles', guest: false, account: true },
  { feature: 'Real-Time Click & Visitor Analytics', guest: false, account: true },
  { feature: 'Link Management Dashboard', guest: false, account: true },
  { feature: 'Device, OS & Referrer Breakdown', guest: false, account: true },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportShortCode, setReportShortCode] = useState('');

  const handleShorten = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/urls', { url: url.trim() });
      setResult(res.data.data);
      toast.success(res.data.message || 'Short URL created successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to shorten URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.short_url) return;
    try {
      await navigator.clipboard.writeText(result.short_url);
      setCopied(true);
      toast.success('Short link copied to clipboard!');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <div className="landing-page">
      {/* Top Header & Navigation */}
      <header className="landing-nav">
        <Link to="/" className="nav-logo" aria-label="Axly Studio Home">
          <div className="logo-icon">
            <Link2 size={20} />
          </div>
          <div>
            <span style={{ letterSpacing: '-0.02em' }}>Axly Studio</span>
          </div>
        </Link>

        <nav className="nav-links desktop-only" style={{ display: 'flex', gap: 28 }}>
          <a href="#shorten" className="nav-link">Shorten</a>
          <a href="#features" className="nav-link">Capabilities</a>
          <a href="#comparison" className="nav-link">Guest vs Account</a>
          <a href="#security" className="nav-link">Security</a>
        </nav>

        <div className="nav-actions">
          <button 
            className="theme-toggle" 
            onClick={toggleTheme} 
            aria-label="Toggle visual theme"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <button 
              className="btn btn-primary" 
              onClick={() => navigate(user.role === 'admin' ? '/admin' : '/app/dashboard')}
            >
              Enter Studio <ArrowRight size={15} style={{ marginLeft: 6 }} />
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link to="/login" className="btn btn-ghost" id="nav-login-btn">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary" id="nav-register-btn">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section" id="shorten">
        <div className="hero-container">
          <div className="hero-badge">
            <Sparkles size={14} style={{ color: 'var(--brand-primary)' }} />
            <span>Next-Generation Link Management</span>
          </div>

          <h1 className="hero-title">
            Transform long links into <span className="gradient-text">fast, privacy-first</span> short URLs.
          </h1>

          <p className="hero-subtitle">
            Generate clean, secure short links instantly as a guest. Create a free account to unlock custom vanity aliases, expiration schedules, and real-time visitor analytics.
          </p>

          {/* Real URL Shortening Form */}
          <div className="shorten-card">
            <form onSubmit={handleShorten} className="shorten-form-container">
              <div className="shorten-input-row">
                <div className="input-icon-left">
                  <Globe size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
                <input
                  id="landing-url-input"
                  type="url"
                  className="shorten-main-input"
                  placeholder="Paste a long destination URL (e.g. https://example.com/campaign/launch)..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  autoComplete="off"
                />
                <button
                  id="shorten-submit-btn"
                  type="submit"
                  className="btn btn-primary shorten-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  ) : (
                    <>Shorten <ArrowRight size={16} style={{ marginLeft: 4 }} /></>
                  )}
                </button>
              </div>
            </form>

            {/* Generated Short Link Result */}
            {result && (
              <div className="shorten-result-card" id="shorten-result-container">
                <div className="result-info">
                  <div className="result-label-row">
                    <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: 'none' }}>
                      Ready to share
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Original: {result.original_url.length > 45 ? `${result.original_url.slice(0, 45)}...` : result.original_url}
                    </span>
                  </div>
                  <a
                    href={result.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="result-short-url"
                    id="result-short-link"
                  >
                    {result.short_url}
                  </a>
                </div>

                <div className="result-actions-cluster">
                  <button
                    id="copy-short-btn"
                    className={`btn ${copied ? 'btn-success' : 'btn-outline'}`}
                    onClick={handleCopy}
                    style={{ minWidth: 105 }}
                  >
                    {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                  </button>
                  <a
                    href={result.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ border: '1px solid var(--border-color)' }}
                  >
                    <ExternalLink size={15} /> Open
                  </a>
                  <button
                    className="btn btn-ghost"
                    style={{ border: '1px solid var(--border-color)', color: '#dc2626' }}
                    onClick={() => {
                      setReportShortCode(result.short_code);
                      setReportModalOpen(true);
                    }}
                    title="Report phishing, malware or abuse"
                  >
                    <ShieldAlert size={15} /> Report Abuse
                  </button>
                </div>

                {/* Guest Contextual Upgrade Prompt */}
                {result.is_guest && (
                  <div className="guest-unlock-banner">
                    <div>
                      <strong>✨ Want custom aliases & click analytics for this link?</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Create a free Axly Studio account to track clicks, download high-res QR codes, and customize links.
                      </div>
                    </div>
                    <Link to="/register" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', flexShrink: 0 }}>
                      Create Free Account
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="features-section" id="features">
        <div className="section-header">
          <h2 className="section-title">Engineered for speed, branding, and insight</h2>
          <p className="section-subtitle">
            A cohesive suite of link management tools built on reliable cloud PostgreSQL infrastructure.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Zap size={24} />
            </div>
            <h3 className="feature-title">High-Speed HTTP Redirects</h3>
            <p className="feature-desc">
              Lightweight 302 redirects with low query overhead route visitors directly to your target destinations in milliseconds.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <Globe size={24} />
            </div>
            <h3 className="feature-title">Custom Branded Vanity Aliases</h3>
            <p className="feature-desc">
              Build memorable links like <code>s.axly.in/launch</code> that reinforce your brand identity across marketing and social channels.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <BarChart2 size={24} />
            </div>
            <h3 className="feature-title">Deep Visitor Analytics</h3>
            <p className="feature-desc">
              Track total clicks, unique visitors, top referrers, device types, browsers, and operating systems with automated aggregations.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              <QrCode size={24} />
            </div>
            <h3 className="feature-title">Dynamic QR Code Generation</h3>
            <p className="feature-desc">
              Generate scannable QR codes for any short link to bridge offline and online campaigns in print, presentations, and product packaging.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <Lock size={24} />
            </div>
            <h3 className="feature-title">Expiration & Status Controls</h3>
            <p className="feature-desc">
              Schedule automatic link expiration timestamps or pause links anytime with one-click active/inactive toggles.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
              <ShieldCheck size={24} />
            </div>
            <h3 className="feature-title">Privacy-Preserving Deduplication</h3>
            <p className="feature-desc">
              HMAC-SHA256 salted hashing identifies unique visitors accurately without storing invasive raw IP addresses or persistent tracking cookies.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Comparison: Guest vs Account */}
      <section className="comparison-section" id="comparison">
        <div className="section-header">
          <h2 className="section-title">Transparent capabilities</h2>
          <p className="section-subtitle">
            Shorten URLs instantly as a guest, or register a free account to take complete ownership of your links.
          </p>
        </div>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th style={{ width: '50%' }}>Capability</th>
                <th style={{ textAlign: 'center', width: '25%' }}>Guest Visitor</th>
                <th style={{ textAlign: 'center', width: '25%' }} className="highlight-column">Axly Studio Member</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((row, idx) => (
                <tr key={idx}>
                  <td><strong>{row.feature}</strong></td>
                  <td style={{ textAlign: 'center' }}>
                    {row.guest ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--success)', verticalAlign: 'middle' }} />
                    ) : (
                      <XCircle size={18} style={{ color: 'var(--text-muted)', verticalAlign: 'middle', opacity: 0.5 }} />
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }} className="highlight-column">
                    <CheckCircle2 size={18} style={{ color: 'var(--brand-primary)', verticalAlign: 'middle' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Architecture & Security Section */}
      <section className="security-section" id="security">
        <div className="security-container">
          <div className="security-header">
            <ShieldCheck size={32} style={{ color: 'var(--brand-primary)', marginBottom: 12 }} />
            <h2 className="section-title" style={{ fontSize: '2rem' }}>Engineered for Enterprise-Grade Security</h2>
            <p className="section-subtitle">
              Every redirect and API request is protected by modern defensive engineering standards.
            </p>
          </div>

          <div className="security-grid">
            <div className="security-card">
              <h4>🛡️ Strict Protocol Validation</h4>
              <p>Rejects unsafe schemes (such as javascript: or data: URIs) and validates fully qualified hostnames.</p>
            </div>
            <div className="security-card">
              <h4>🔒 Role-Based Access Control</h4>
              <p>Database-enforced separation between standard users and system administrators on every protected endpoint.</p>
            </div>
            <div className="security-card">
              <h4>⚡ Intelligent Rate Limiting</h4>
              <p>Independent rate limit tiers protect public endpoints and prevent credential abuse or denial of service.</p>
            </div>
            <div className="security-card">
              <h4>🐘 PostgreSQL Persistence</h4>
              <p>ACID-compliant storage powered by Lakebase Postgres on Neon with encrypted TLS 1.3 database connections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="cta-section">
        <div className="cta-container">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 800, marginBottom: 14 }}>
            Ready to take control of your links?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 580, margin: '0 auto 32px' }}>
            Start shortening links immediately, or create a free account to explore real-time analytics and branded vanity links.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '1rem' }}>
              Create Free Account <ArrowRight size={16} style={{ marginLeft: 6 }} />
            </Link>
            <a href="#shorten" className="btn btn-outline" style={{ padding: '14px 28px', fontSize: '1rem' }}>
              Shorten a Link Now
            </a>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo-icon">
              <Link2 size={16} />
            </div>
            <span>Axly Studio</span>
          </div>

          <div style={{ display: 'flex', gap: 24, fontSize: '0.88rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#comparison" className="nav-link">Capabilities</a>
            <a href="#security" className="nav-link">Security</a>
            <button 
              className="nav-link" 
              onClick={() => { setReportShortCode(''); setReportModalOpen(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626' }}
            >
              <ShieldAlert size={14} /> Report Abuse
            </button>
            <Link to="/login" className="nav-link">Sign In</Link>
          </div>

          <p className="footer-copy">
            © 2026 Axly Studio. Built for speed, security, and privacy.
          </p>
        </div>
      </footer>

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        shortCode={reportShortCode}
      />
    </div>
  );
}
