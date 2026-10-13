import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Link2, ArrowRight, Moon, Sun, Copy, Check, ExternalLink, 
  ShieldCheck, Zap, BarChart2, Globe, QrCode, Lock,
  CheckCircle2, XCircle, ShieldAlert, Shield, Database,
  UserRound, PanelsTopLeft, Megaphone, GitCompare, Users, Code2, Mail, Menu, X,
  SlidersHorizontal, Sparkles
} from 'lucide-react';
import AxlyLogo from '../components/AxlyLogo';
import { useTheme } from '../context/ThemeContext';
import { useAuth, api } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';
import toast from 'react-hot-toast';

const COMPARISON_FEATURES = [
  { feature: 'Instant URL Shortening', guest: true, account: true },
  { feature: 'Standard short links and QR code export', guest: true, account: true },
  { feature: 'Custom aliases and vanity links', guest: false, account: true },
  { feature: 'Link expiration and pause controls', guest: false, account: true },
  { feature: 'Click and visitor analytics', guest: false, account: true },
  { feature: 'Public link-in-bio & creator portfolio pages', guest: false, account: true },
  { feature: 'Custom domains for pages and links', guest: false, account: true },
  { feature: 'Campaigns and UTM tracking builder', guest: false, account: true },
  { feature: 'A/B destination experiments', guest: false, account: true },
  { feature: 'Consent-based lead capture forms', guest: false, account: true },
  { feature: 'Page revision history & restore', guest: false, account: true },
  { feature: 'Shared workspaces & team collaboration', guest: false, account: true },
  { feature: 'Developer platform & API workflows', guest: false, account: true },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [aliasMode, setAliasMode] = useState('auto'); // 'auto' | 'custom'
  const [customAlias, setCustomAlias] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportShortCode, setReportShortCode] = useState('');

  const shortDomain = window.location.hostname.includes('axly.in') 
    ? 's.axly.in' 
    : window.location.host;

  const handleShorten = async (e) => {
    e.preventDefault();
    setFormError('');
    const trimmed = url.trim();
    if (!trimmed) {
      setFormError('Enter a valid destination URL.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload = { url: trimmed };
      if (aliasMode === 'custom' && customAlias.trim()) {
        payload.customAlias = customAlias.trim();
      }

      const res = await api.post('/urls', payload);
      setResult(res.data.data);
      toast.success(res.data.message || 'Your short link is ready to copy and share.');
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('already taken') || msg.toLowerCase().includes('in use')) {
        setFormError('This alias is already taken. Try another one.');
      } else if (msg.toLowerCase().includes('alias')) {
        setFormError('Use letters, numbers, and supported characters (3-30 characters).');
      } else if (msg.toLowerCase().includes('valid url') || msg.toLowerCase().includes('invalid')) {
        setFormError('Enter a valid destination URL (e.g. https://example.com).');
      } else {
        setFormError(msg || 'Failed to shorten URL. Please check your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.short_url) return;
    try {
      await navigator.clipboard.writeText(result.short_url);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <div className="landing-page">
      {/* Top Header & Navigation */}
      <header className="landing-nav">
        <Link to="/" className="nav-logo" aria-label="Axly Studio Home" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <AxlyLogo size="md" />
        </Link>

        <nav className={`nav-links landing-nav-links ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
          <a href="#shorten" className="nav-link" onClick={() => setMobileNavOpen(false)}>URL Shortener</a>
          <Link to="/qr" className="nav-link" onClick={() => setMobileNavOpen(false)}>QR Codes</Link>
          <a href="#pages" className="nav-link" onClick={() => setMobileNavOpen(false)}>Public Pages</a>
          <a href="#features" className="nav-link" onClick={() => setMobileNavOpen(false)}>Features</a>
          <Link to="/help" className="nav-link" onClick={() => setMobileNavOpen(false)}>Help &amp; Guides</Link>
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

      {/* Hero Section with URL Shortener as Primary Action */}
      <section className="hero-section" id="shorten">
        <div className="hero-container">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            <span className="hero-badge-tag">AXLY STUDIO</span>
            <span className="hero-badge-divider">/</span>
            <span>Link Management &amp; Digital Presence</span>
          </div>

          <h1 className="hero-title">
            Shorten links. Build pages. <span className="gradient-text">Grow your reach.</span>
          </h1>

          <p className="hero-subtitle">
            Create shareable short links, generate QR codes, publish public profile pages, and understand your audience with Axly Studio.
          </p>

          {/* Primary URL Shortening Form */}
          <div className="shorten-card">
            <form onSubmit={handleShorten} className="shorten-form-container">
              {formError && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}>
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="shorten-input-row">
                <div className="input-icon-left">
                  <Globe size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
                <input
                  id="landing-url-input"
                  type="url"
                  className="shorten-main-input"
                  placeholder="Paste your long URL here (e.g. https://example.com/summer-sale)..."
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (formError) setFormError(''); }}
                  required
                  autoComplete="off"
                  aria-label="Paste your long destination URL"
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
                    <>Shorten URL <ArrowRight size={16} style={{ marginLeft: 4 }} /></>
                  )}
                </button>
              </div>

              {/* Optional Custom Alias Switcher */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setAliasMode('auto')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: aliasMode === 'auto' ? 'var(--bg-card)' : 'transparent',
                      color: aliasMode === 'auto' ? 'var(--brand-primary)' : 'var(--text-muted)',
                      fontWeight: aliasMode === 'auto' ? 600 : 400,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: aliasMode === 'auto' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <Sparkles size={12} /> Generate automatically
                  </button>
                  <button
                    type="button"
                    onClick={() => setAliasMode('custom')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: aliasMode === 'custom' ? 'var(--bg-card)' : 'transparent',
                      color: aliasMode === 'custom' ? 'var(--brand-primary)' : 'var(--text-muted)',
                      fontWeight: aliasMode === 'custom' ? 600 : 400,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: aliasMode === 'custom' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <SlidersHorizontal size={12} /> Customize link
                  </button>
                </div>

                {aliasMode === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {shortDomain}/
                    </span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.82rem', height: 32 }}
                      placeholder="summer-sale"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value)}
                      pattern="[a-zA-Z0-9_-]{3,30}"
                      title="3-30 letters, numbers, hyphens, and underscores"
                    />
                  </div>
                )}
              </div>

              {aliasMode === 'custom' && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Preview: <strong style={{ color: 'var(--brand-primary)' }}>{shortDomain}/{customAlias.trim() || 'your-alias'}</strong>
                  {!user && (
                    <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>
                      · Custom aliases require an account. <Link to="/register" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>Sign up free</Link>
                    </span>
                  )}
                </div>
              )}
            </form>

            {/* Generated Short Link Result Area */}
            {result && (
              <div className="shorten-result-card" id="shorten-result-container">
                <div className="result-info">
                  <div className="result-label-row">
                    <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: 'none' }}>
                      Short link ready
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Original: {result.original_url.length > 40 ? `${result.original_url.slice(0, 40)}...` : result.original_url}
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
                  <Link
                    to={`/qr?url=${encodeURIComponent(result.short_url)}`}
                    className="btn btn-ghost"
                    style={{ border: '1px solid var(--border-color)' }}
                    title="Generate QR code for this link"
                  >
                    <QrCode size={15} /> QR Code
                  </Link>
                  <button
                    className="btn btn-ghost"
                    style={{ border: '1px solid var(--border-color)', color: '#dc2626' }}
                    onClick={() => {
                      setReportShortCode(result.short_code);
                      setReportModalOpen(true);
                    }}
                    title="Report phishing, malware or abuse"
                  >
                    <ShieldAlert size={15} /> Report
                  </button>
                </div>

                {/* Guest Contextual Upgrade Prompt */}
                {result.is_guest && (
                  <div className="guest-unlock-banner">
                    <div>
                      <strong><Link2 size={13} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--brand-primary)' }} /> Want to track clicks and customize this link?</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Create a free Axly Studio account to view real-time visitor stats, edit destinations, and download high-res vector QR codes.
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

      {/* Product Suite Section */}
      <section className="features-section" id="features">
        <div className="section-header">
          <h2 className="section-title">The Complete Digital Presence Suite</h2>
          <p className="section-subtitle">
            Start with a fast short link, then expand into QR codes, branded profile pages, domains, and campaign tracking as you grow.
          </p>
        </div>

        <div className="features-grid">
          {/* 1. Short Links */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Link2 size={24} />
            </div>
            <h3 className="feature-title">Short Links</h3>
            <p className="feature-desc">
              Create, organize, customize, and manage shortened URLs with millisecond redirect speeds and automated status controls.
            </p>
            <a href="#shorten" className="feature-card-link">
              Shorten a link <ArrowRight size={14} />
            </a>
          </div>

          {/* 2. QR Codes */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <QrCode size={24} />
            </div>
            <h3 className="feature-title">QR Codes</h3>
            <p className="feature-desc">
              Generate scannable QR codes for any website or short link. Customize color schemes, adjust resolution, and download in vector SVG or PNG.
            </p>
            <Link to="/qr" className="feature-card-link">
              Generate QR codes <ArrowRight size={14} />
            </Link>
          </div>

          {/* 3. Public Pages */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <PanelsTopLeft size={24} />
            </div>
            <h3 className="feature-title">Public Pages</h3>
            <p className="feature-desc">
              Build link-in-bio pages, creator portfolios, business pages, and digital business cards without code.
            </p>
            <Link to={user ? '/app/pages' : '/register'} className="feature-card-link">
              Build a public page <ArrowRight size={14} />
            </Link>
          </div>

          {/* 4. Custom Domains */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#ecfeff', color: '#0e7490' }}>
              <Globe size={24} />
            </div>
            <h3 className="feature-title">Custom Domains</h3>
            <p className="feature-desc">
              Connect verified domains to your public pages or branded short links after standard DNS configuration.
            </p>
            <Link to={user ? '/app/domains' : '/register'} className="feature-card-link">
              Connect domains <ArrowRight size={14} />
            </Link>
          </div>

          {/* 5. Link Analytics */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
              <BarChart2 size={24} />
            </div>
            <h3 className="feature-title">Link Analytics</h3>
            <p className="feature-desc">
              Track total clicks, unique visitors, referrers, device types, operating systems, and top geographic locations with privacy-first deduplication.
            </p>
            <Link to={user ? '/app/analytics' : '/register'} className="feature-card-link">
              View analytics <ArrowRight size={14} />
            </Link>
          </div>

          {/* 6. Campaigns & UTM */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#fff7ed', color: '#c2410c' }}>
              <Megaphone size={24} />
            </div>
            <h3 className="feature-title">Campaigns &amp; UTM Tracking</h3>
            <p className="feature-desc">
              Organize campaign links with consistent UTM parameters to accurately measure attribution across ads, email, and social posts.
            </p>
            <Link to={user ? '/app/campaigns' : '/register'} className="feature-card-link">
              Manage campaigns <ArrowRight size={14} />
            </Link>
          </div>

          {/* 7. A/B Experiments */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#fdf2f8', color: '#be185d' }}>
              <GitCompare size={24} />
            </div>
            <h3 className="feature-title">A/B Experiments</h3>
            <p className="feature-desc">
              Compare destination variants with weighted traffic distribution to evaluate which landing page converts better.
            </p>
            <Link to={user ? '/app/experiments' : '/register'} className="feature-card-link">
              Explore experiments <ArrowRight size={14} />
            </Link>
          </div>

          {/* 8. Teams & Developer Tools */}
          <div className="feature-card">
            <div className="feature-icon" style={{ background: '#f0fdf4', color: '#15803d' }}>
              <Users size={24} />
            </div>
            <h3 className="feature-title">Teams &amp; Developer Tools</h3>
            <p className="feature-desc">
              Collaborate across workspaces, invite team members with role controls, and automate link creation with developer REST APIs.
            </p>
            <Link to={user ? '/app/teams' : '/register'} className="feature-card-link">
              Open workspaces <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* How Axly Works Section */}
      <section className="how-it-works-section" style={{ padding: '64px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand-primary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            <Sparkles size={14} /> Intuitive 3-Step Flow
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 800, margin: '0 0 10px' }}>
            How Axly Works
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 600, margin: '0 auto 40px' }}>
            No steep learning curves or complicated configurations. Start achieving more in minutes.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, textAlign: 'left' }}>
            <div className="card" style={{ padding: 28, background: 'var(--bg-card)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,99,235,0.1)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>
                1
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px' }}>Create</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Shorten a link with an optional custom alias, generate a customized QR code, or build a public profile page.
              </p>
            </div>

            <div className="card" style={{ padding: 28, background: 'var(--bg-card)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>
                2
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px' }}>Share</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Share your short link or QR code across social media bios, email campaigns, printed business cards, and ad promotions.
              </p>
            </div>

            <div className="card" style={{ padding: 28, background: 'var(--bg-card)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.1)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>
                3
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px' }}>Understand</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Review real-time clicks, unique visitors, top geographic referrers, and device breakdowns in your clean analytics dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Public Page Builder Showcase */}
      <section className="pages-showcase-section" id="pages">
        <div className="pages-showcase-container">
          <div className="pages-showcase-copy">
            <span className="pages-showcase-eyebrow"><PanelsTopLeft size={14} /> PUBLIC LINK &amp; BIO SUITE</span>
            <h2>One link can tell your whole story.</h2>
            <p>
              Build a shareable page for your portfolio, creator profile, business, or contact card. Choose a starter template, add content blocks, customize styling, and publish under url.axly.in or your own verified domain.
            </p>
            <div className="pages-showcase-checklist">
              <span><CheckCircle2 size={17} /> 5 professional starter templates (Bio, Creator, Dev, Business, Card)</span>
              <span><CheckCircle2 size={17} /> Links, social icons, video embeds, and lead forms</span>
              <span><CheckCircle2 size={17} /> SEO title/meta preview, visit analytics, and revision history</span>
            </div>
            <div className="pages-showcase-actions">
              <Link to={user ? '/app/pages' : '/register'} className="btn btn-primary">
                Create a Public Page <ArrowRight size={16} />
              </Link>
              <Link to={user ? '/app/pages' : '/register'} className="btn btn-outline">
                Explore Templates
              </Link>
            </div>
          </div>

          <div className="pages-showcase-preview" aria-label="Example Axly public page preview">
            <div className="pages-preview-browser-bar">
              <div className="pages-preview-dots"><i /><i /><i /></div>
              <span className="pages-preview-host"><Globe size={13} /> url.axly.in/p/alex</span>
              <span className="pages-preview-live">LIVE PREVIEW</span>
            </div>
            <div className="pages-preview-canvas">
              <div className="pages-preview-avatar">A</div>
              <p className="pages-preview-name">Alex Morgan</p>
              <p className="pages-preview-bio">Product Designer &amp; Software Builder</p>
              <div className="pages-preview-tags"><span>Portfolio</span><span>Creator</span><span>Business</span></div>
              <div className="pages-preview-links">
                {['Design Portfolio & Case Studies', 'Latest YouTube Tutorial', 'Schedule a Consultation'].map((label) => (
                  <div className="pages-preview-link" key={label}>
                    <span>{label}</span><ArrowRight size={15} />
                  </div>
                ))}
              </div>
              <div className="pages-preview-socials"><span>GitHub</span><span>LinkedIn</span><span>Twitter</span></div>
              <p className="pages-preview-powered">Powered by Axly Studio</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison: Guest vs Account */}
      <section className="comparison-section" id="comparison">
        <div className="section-header">
          <h2 className="section-title">Transparent Capabilities</h2>
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
            <div className="security-header-badge">
              <ShieldCheck size={16} />
              <span>DEFENSIVE ARCHITECTURE</span>
            </div>
            <h2 className="section-title" style={{ fontSize: '2.25rem', marginTop: 14 }}>
              Engineered for Enterprise-Grade Reliability
            </h2>
            <p className="section-subtitle" style={{ maxWidth: 640, margin: '8px auto 0' }}>
              Every redirect, API payload, and database transaction is strictly verified by modern defensive engineering standards.
            </p>
          </div>

          <div className="security-grid">
            <div className="security-card">
              <div className="security-card-top">
                <div className="security-icon-box">
                  <Shield size={20} />
                </div>
                <span className="security-card-pill">RFC 3986</span>
              </div>
              <h3 className="security-card-title">Strict Protocol Validation</h3>
              <p className="security-card-desc">
                Automated filtering rejects dangerous pseudo-schemes (javascript:, data:) with loop prevention and SSRF protection.
              </p>
            </div>

            <div className="security-card">
              <div className="security-card-top">
                <div className="security-icon-box">
                  <Lock size={20} />
                </div>
                <span className="security-card-pill">Zero Trust</span>
              </div>
              <h3 className="security-card-title">Role-Based Access Control</h3>
              <p className="security-card-desc">
                Database-level policy separation strictly isolates system administration, workspace team roles, and public traffic.
              </p>
            </div>

            <div className="security-card">
              <div className="security-card-top">
                <div className="security-icon-box">
                  <Zap size={20} />
                </div>
                <span className="security-card-pill">Token Bucket</span>
              </div>
              <h3 className="security-card-title">Intelligent Rate Limiting</h3>
              <p className="security-card-desc">
                Independent sliding-window rate limit tiers shield public endpoints, API tokens, and authentication against brute-force abuse.
              </p>
            </div>

            <div className="security-card">
              <div className="security-card-top">
                <div className="security-icon-box">
                  <Database size={20} />
                </div>
                <span className="security-card-pill">TLS 1.3 / ACID</span>
              </div>
              <h3 className="security-card-title">Lakebase Postgres Engine</h3>
              <p className="security-card-desc">
                Enterprise ACID durability powered by Lakebase Postgres on Neon with encrypted TLS 1.3 database connections.
              </p>
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
          <div className="footer-brand" style={{ display: 'flex', alignItems: 'center' }}>
            <AxlyLogo size="sm" />
          </div>

          <div style={{ display: 'flex', gap: 24, fontSize: '0.88rem', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="#shorten" className="nav-link">Shorten</a>
            <Link to="/qr" className="nav-link">QR Codes</Link>
            <a href="#pages" className="nav-link">Public Pages</a>
            <a href="#features" className="nav-link">Features</a>
            <Link to="/help" className="nav-link">Help &amp; Guides</Link>
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
