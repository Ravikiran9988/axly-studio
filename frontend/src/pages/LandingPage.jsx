import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Link2, ArrowRight, Moon, Sun, Copy, Check, ExternalLink, 
  ShieldCheck, Zap, BarChart2, Globe, Sparkles, QrCode, Lock,
  CheckCircle2, XCircle, ShieldAlert, UserRound, PanelsTopLeft, Megaphone,
  GitCompare, Users, Code2, Mail, Menu, X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth, api } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';
import toast from 'react-hot-toast';

const COMPARISON_FEATURES = [
  { feature: 'Instant URL Shortening', guest: true, account: true },
  { feature: 'Standard short links and QR preview', guest: true, account: true },
  { feature: 'Custom aliases and expiring links', guest: false, account: true },
  { feature: 'Link expiry and status controls', guest: false, account: true },
  { feature: 'Click and visitor analytics', guest: false, account: true },
  { feature: 'Public link-in-bio and portfolio pages', guest: false, account: true },
  { feature: 'Custom domains for pages and links', guest: false, account: true },
  { feature: 'Campaigns and UTM tracking', guest: false, account: true },
  { feature: 'A/B link experiments', guest: false, account: true },
  { feature: 'Lead forms and CSV export', guest: false, account: true },
  { feature: 'Page revision history and restore', guest: false, account: true },
  { feature: 'Teams and shared workspaces', guest: false, account: true },
  { feature: 'Developer tools and API workflows', guest: false, account: true },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

        <nav className={`nav-links landing-nav-links ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
          <a href="#shorten" className="nav-link" onClick={() => setMobileNavOpen(false)}>Shorten</a>
          <a href="#pages" className="nav-link" onClick={() => setMobileNavOpen(false)}>Pages</a>
          <a href="#features" className="nav-link" onClick={() => setMobileNavOpen(false)}>Platform</a>
          <a href="#security" className="nav-link" onClick={() => setMobileNavOpen(false)}>Security</a>
        </nav>

        <div className="nav-actions landing-nav-actions">
          <button
            type="button"
            className="landing-mobile-menu-toggle"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            title={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <button 
            className="theme-toggle" 
            onClick={toggleTheme} 
            aria-label="Toggle visual theme"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="landing-signed-in-actions">
              <Link to="/app/profile" className="landing-profile-shortcut" aria-label="Open your profile">
                <span className="landing-profile-avatar">
                  {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || <UserRound size={16} />}
                </span>
                <span className="landing-profile-label">Profile</span>
              </Link>
              <button
                className="btn btn-primary"
                onClick={() => navigate(user.role === 'admin' ? '/admin' : '/app/dashboard')}
              >
                Open Studio <ArrowRight size={15} style={{ marginLeft: 6 }} />
              </button>
            </div>
          ) : (
            <div className="landing-guest-actions">
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
            <span>One workspace for every destination</span>
          </div>

          <h1 className="hero-title">
            Your links, pages, and <span className="gradient-text">digital presence</span> in one place.
          </h1>

          <p className="hero-subtitle">
            Shorten links in seconds, publish a polished link-in-bio page, connect your brand domain, and understand what works with campaign and visitor insights.
          </p>

          <div className="hero-capability-pills" aria-label="Axly platform capabilities">
            <span className="hero-capability-pill"><Link2 size={15} /> Short links</span>
            <span className="hero-capability-pill"><PanelsTopLeft size={15} /> Public pages</span>
            <span className="hero-capability-pill"><Globe size={15} /> Custom domains</span>
            <span className="hero-capability-pill"><BarChart2 size={15} /> Campaign insights</span>
          </div>

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
          <h2 className="section-title">Everything you need to grow your digital presence</h2>
          <p className="section-subtitle">
            Bring short links, landing pages, domain branding, experiments, and campaign measurement together in one workspace.
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

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}>
              <PanelsTopLeft size={24} />
            </div>
            <h3 className="feature-title">Link-in-Bio & Public Pages</h3>
            <p className="feature-desc">
              Publish creator pages, portfolios, business pages, or a digital business card with flexible blocks and starter templates.
            </p>
            <Link to={user ? '/app/pages' : '/register'} className="feature-card-link">
              Build a page <ArrowRight size={14} />
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#ecfeff', color: '#0e7490' }}>
              <Globe size={24} />
            </div>
            <h3 className="feature-title">Custom Domains</h3>
            <p className="feature-desc">
              Keep your brand front and center with your own domain for published pages or branded short links, after DNS and hosting verification.
            </p>
            <Link to={user ? '/app/domains' : '/register'} className="feature-card-link">
              Explore domains <ArrowRight size={14} />
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#fff7ed', color: '#c2410c' }}>
              <Megaphone size={24} />
            </div>
            <h3 className="feature-title">Campaigns & UTM Builder</h3>
            <p className="feature-desc">
              Organize campaigns with consistent UTM parameters and share trackable links across marketing channels.
            </p>
            <Link to={user ? '/app/campaigns' : '/register'} className="feature-card-link">
              Manage campaigns <ArrowRight size={14} />
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#fdf2f8', color: '#be185d' }}>
              <GitCompare size={24} />
            </div>
            <h3 className="feature-title">A/B Link Experiments</h3>
            <p className="feature-desc">
              Compare destination variants and review performance to learn which link experience is working better.
            </p>
            <Link to={user ? '/app/experiments' : '/register'} className="feature-card-link">
              Explore experiments <ArrowRight size={14} />
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#f0fdf4', color: '#15803d' }}>
              <Users size={24} />
            </div>
            <h3 className="feature-title">Teams & Workspaces</h3>
            <p className="feature-desc">
              Keep collaboration organized with shared workspaces and team-oriented link workflows.
            </p>
            <Link to={user ? '/app/teams' : '/register'} className="feature-card-link">
              Open workspaces <ArrowRight size={14} />
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              <Code2 size={24} />
            </div>
            <h3 className="feature-title">Developer Platform</h3>
            <p className="feature-desc">
              Find developer-facing tools and integration workflows from one place, with domain setup and API-oriented features.
            </p>
            <Link to={user ? '/app/developer' : '/register'} className="feature-card-link">
              Open developer tools <ArrowRight size={14} />
            </Link>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
              <Mail size={24} />
            </div>
            <h3 className="feature-title">Lead Capture & Page Insights</h3>
            <p className="feature-desc">
              Add consent-based lead forms, review page views and link clicks, export leads, and restore earlier page revisions.
            </p>
            <Link to={user ? '/app/pages' : '/register'} className="feature-card-link">
              Explore page tools <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Public page builder showcase */}
      <section className="pages-showcase-section" id="pages">
        <div className="pages-showcase-container">
          <div className="pages-showcase-copy">
            <span className="pages-showcase-eyebrow"><Sparkles size={14} /> CREATE YOUR OWN SPACE</span>
            <h2>One link can tell your whole story.</h2>
            <p>
              Build a shareable page for your portfolio, creator profile, business, or contact card. Start from a template, add links and content blocks, then publish to an Axly URL or a verified custom domain.
            </p>
            <div className="pages-showcase-checklist">
              <span><CheckCircle2 size={17} /> Five starter templates</span>
              <span><CheckCircle2 size={17} /> Links, social profiles, media and lead forms</span>
              <span><CheckCircle2 size={17} /> SEO fields, analytics and revision history</span>
            </div>
            <div className="pages-showcase-actions">
              <Link to={user ? '/app/pages' : '/register'} className="btn btn-primary">
                Create a public page <ArrowRight size={16} />
              </Link>
              <Link to={user ? '/app/domains' : '/register'} className="btn btn-outline">
                Connect a domain <Globe size={16} />
              </Link>
            </div>
          </div>

          <div className="pages-showcase-preview" aria-label="Example Axly public page preview">
            <div className="pages-preview-browser-bar">
              <div className="pages-preview-dots"><i /><i /><i /></div>
              <span className="pages-preview-host"><Globe size={13} /> yourname.axly.in</span>
              <span className="pages-preview-live">LIVE PREVIEW</span>
            </div>
            <div className="pages-preview-canvas">
              <div className="pages-preview-avatar">A</div>
              <p className="pages-preview-name">Alex Morgan</p>
              <p className="pages-preview-bio">Designer · Builder · Creator</p>
              <div className="pages-preview-tags"><span>Portfolio</span><span>Creator</span><span>Business</span></div>
              <div className="pages-preview-links">
                {['Featured work & projects', 'Latest video and updates', 'Book a call'].map((label) => (
                  <div className="pages-preview-link" key={label}>
                    <span>{label}</span><ArrowRight size={15} />
                  </div>
                ))}
              </div>
              <div className="pages-preview-socials"><span>GitHub</span><span>LinkedIn</span><span>Instagram</span></div>
              <p className="pages-preview-powered">Made with Axly Studio</p>
            </div>
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
              <p>Persistent PostgreSQL storage on Neon with encrypted TLS database connections.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="cta-section">
        <div className="cta-container">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 800, marginBottom: 14 }}>
            Your next destination starts with Axly.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 580, margin: '0 auto 32px' }}>
            Start with a free short link, then bring your public pages, branded domains, campaigns, and insights into one workspace.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={user ? '/app/pages' : '/register'} className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '1rem' }}>
              {user ? 'Build a Public Page' : 'Create Free Account'} <ArrowRight size={16} style={{ marginLeft: 6 }} />
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
            <a href="#features" className="nav-link">Platform</a>
            <a href="#pages" className="nav-link">Public Pages</a>
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
