import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { 
  Link2, ArrowRight, Moon, Sun, Copy, Check, ExternalLink, 
  ShieldCheck, Zap, BarChart2, Globe, QrCode, Lock,
  CheckCircle2, XCircle, ShieldAlert, Shield, Database, Activity,
  UserRound, PanelsTopLeft, Megaphone, GitCompare, Users, Code2, Mail, Menu, X, Download
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth, api } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
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
  const [qrInput, setQrInput] = useState('');
  const [qrValue, setQrValue] = useState('');
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

  // Generate the QR code locally so guest visitors don't need an account.
  const handleGenerateQr = (event) => {
    event.preventDefault();
    const rawValue = qrInput.trim();
    if (!rawValue) return;

    try {
      const parsedUrl = new URL(rawValue);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        toast.error('Enter a website URL starting with http:// or https://.');
        return;
      }
      setQrValue(parsedUrl.href);
      toast.success('QR code is ready. No sign-in required.');
    } catch {
      toast.error('Enter a valid website URL, including https://.');
    }
  };

  const handleCopyQrUrl = async () => {
    if (!qrValue) return;
    try {
      await navigator.clipboard.writeText(qrValue);
      toast.success('URL copied to clipboard.');
    } catch {
      toast.error('Could not copy the URL. Please select and copy it.');
    }
  };

  const handleDownloadQrPng = () => {
    const canvas = document.querySelector('#landing-qr-canvas canvas');
    if (!canvas || !qrValue) {
      toast.error('Generate a QR code first.');
      return;
    }
    const downloadLink = document.createElement('a');
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.download = 'axly-qr-code.png';
    downloadLink.click();
  };

  const handleDownloadQrSvg = () => {
    const svg = document.querySelector('#landing-qr-svg');
    if (!svg || !qrValue) {
      toast.error('Generate a QR code first.');
      return;
    }
    const svgClone = svg.cloneNode(true);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([new XMLSerializer().serializeToString(svgClone)], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = objectUrl;
    downloadLink.download = 'axly-qr-code.svg';
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  return (
    <div className="landing-page">
      {/* Top Header & Navigation */}
      <header className="landing-nav">
        <Link to="/" className="nav-logo" aria-label="Axly Studio Home">
          <div className="logo-icon">
            <BrandMark size={25} />
          </div>
          <div>
            <span style={{ letterSpacing: '-0.02em' }}>Axly Studio</span>
          </div>
        </Link>

        <nav className={`nav-links landing-nav-links ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Main navigation">
          <a href="#shorten" className="nav-link" onClick={() => setMobileNavOpen(false)}>Shorten</a>
          <a href="#qr-codes" className="nav-link" onClick={() => setMobileNavOpen(false)}>QR Codes</a>
          <a href="#pages" className="nav-link" onClick={() => setMobileNavOpen(false)}>Pages</a>
          <a href="#features" className="nav-link" onClick={() => setMobileNavOpen(false)}>Platform</a>
          <a href="#security" className="nav-link" onClick={() => setMobileNavOpen(false)}>Security</a>
          {!user && (
            <>
              <Link to="/login" className="nav-link landing-mobile-auth-link" onClick={() => setMobileNavOpen(false)}>Sign in</Link>
              <Link to="/register" className="nav-link landing-mobile-auth-link landing-mobile-auth-primary" onClick={() => setMobileNavOpen(false)}>Create a free account</Link>
            </>
          )}
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
                <span className="landing-profile-avatar" style={{ overflow: 'hidden' }}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name || 'Profile'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || <UserRound size={16} />
                  )}
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
          <a href="#pages" className="hero-badge" aria-label="Explore Axly Studio public pages and link tools">
            <span className="hero-badge-chip">LINKS MADE SIMPLE</span>
            <span className="hero-badge-text">Short links, QR codes &amp; public pages</span>
            <ArrowRight size={13} className="hero-badge-arrow" />
          </a>

          <h1 className="hero-title">
            Shorten links. <span className="gradient-text">Share smarter.</span>
          </h1>

          <p className="hero-subtitle">
            Create a short link in seconds. Generate QR codes for free, publish a public page, and see how your links perform.
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
                  placeholder="Paste your long URL (https://example.com)"
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
                      <strong><Link2 size={13} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--brand-primary)' }} /> Want custom aliases &amp; click analytics for this link?</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Create a free Axly Studio account to manage saved links, customize aliases, and review analytics.
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
          <div className="hero-capability-pills" aria-label="Axly platform capabilities">
            <span className="hero-capability-pill"><Link2 size={15} /> Short links</span>
            <span className="hero-capability-pill"><PanelsTopLeft size={15} /> Public pages</span>
            <span className="hero-capability-pill"><Globe size={15} /> Custom domains</span>
            <span className="hero-capability-pill"><BarChart2 size={15} /> Campaign insights</span>
          </div>

        </div>
      </section>

      {/* Free QR Code Generator — generated locally, no account required */}
      <section className="qr-generator-section" id="qr-codes">
        <div className="qr-generator-container">
          <div className="qr-generator-intro">
            <span className="qr-generator-eyebrow"><QrCode size={15} /> FREE TOOL · NO SIGN-IN</span>
            <h2>QR Code Generator</h2>
            <p>Turn any website URL into a scannable QR code. Paste a link, generate your code, and download it for posters, packaging, menus, or social profiles.</p>
            <div className="qr-generator-benefits">
              <span><CheckCircle2 size={16} /> Any http:// or https:// website</span>
              <span><CheckCircle2 size={16} /> Generated directly in your browser</span>
              <span><CheckCircle2 size={16} /> Download PNG or SVG</span>
            </div>
          </div>

          <div className="qr-generator-workspace">
            <form className="qr-generator-form" onSubmit={handleGenerateQr}>
              <label htmlFor="landing-qr-url">Website URL</label>
              <input
                id="landing-qr-url"
                className="qr-generator-input"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com"
                value={qrInput}
                onChange={(event) => {
                  setQrInput(event.target.value);
                  if (qrValue) setQrValue('');
                }}
                required
              />
              <p className="qr-generator-help">Tip: a QR code containing an Axly short link can keep the printed code the same if you later update that link's destination, where supported.</p>
              <button type="submit" className="btn btn-primary qr-generator-submit">
                <QrCode size={17} /> Generate QR Code
              </button>
            </form>

            <div className={`qr-generator-result ${qrValue ? 'has-qr' : ''}`} aria-live="polite">
              {qrValue ? (
                <>
                  <div className="qr-generator-image">
                    <QRCodeSVG
                      id="landing-qr-svg"
                      value={qrValue}
                      size={208}
                      level="H"
                      includeMargin
                      bgColor="#ffffff"
                      fgColor="#111827"
                      title="Generated QR code"
                    />
                  </div>
                  <p className="qr-generator-result-label">Your QR code is ready</p>
                  <p className="qr-generator-result-url">{qrValue}</p>
                  <div className="qr-generator-downloads">
                    <button type="button" className="btn btn-outline" onClick={handleCopyQrUrl}>
                      <Copy size={15} /> Copy URL
                    </button>
                    <button type="button" className="btn btn-outline" onClick={handleDownloadQrSvg}>
                      <Download size={15} /> SVG
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleDownloadQrPng}>
                      <Download size={15} /> PNG
                    </button>
                  </div>
                  <div id="landing-qr-canvas" className="qr-generator-export-canvas" aria-hidden="true">
                    <QRCodeCanvas value={qrValue} size={1024} level="H" includeMargin bgColor="#ffffff" fgColor="#111827" />
                  </div>
                </>
              ) : (
                <>
                  <div className="qr-generator-placeholder-icon"><QrCode size={34} /></div>
                  <strong>Your QR code will appear here</strong>
                  <p>Enter a website address and choose Generate QR Code.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Public page builder showcase */}
      <section className="pages-showcase-section" id="pages">
        <div className="pages-showcase-container">
          <div className="pages-showcase-copy">
            <span className="pages-showcase-eyebrow"><PanelsTopLeft size={14} /> PUBLIC LINK & BIO SUITE</span>
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
            <div className="feature-icon feature-icon-blue">
              <Zap size={24} />
            </div>
            <h3 className="feature-title">High-Speed HTTP Redirects</h3>
            <p className="feature-desc">
              Lightweight 302 redirects with low query overhead route visitors directly to your target destinations in milliseconds.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-purple">
              <Globe size={24} />
            </div>
            <h3 className="feature-title">Custom Branded Vanity Aliases</h3>
            <p className="feature-desc">
              Build memorable links like <code>s.axly.in/launch</code> that reinforce your brand identity across marketing and social channels.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-emerald">
              <BarChart2 size={24} />
            </div>
            <h3 className="feature-title">Deep Visitor Analytics</h3>
            <p className="feature-desc">
              Track total clicks, unique visitors, top referrers, device types, browsers, and operating systems with automated aggregations.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-amber">
              <QrCode size={24} />
            </div>
            <h3 className="feature-title">Free QR Code Generator</h3>
            <p className="feature-desc">
              Turn any website URL into a scannable code directly in your browser, then download a PNG or SVG without signing in.
            </p>
            <a href="#qr-codes" className="feature-card-link">
              Generate a QR code <ArrowRight size={14} />
            </a>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-red">
              <Lock size={24} />
            </div>
            <h3 className="feature-title">Expiration & Status Controls</h3>
            <p className="feature-desc">
              Schedule automatic link expiration timestamps or pause links anytime with one-click active/inactive toggles.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-cyan">
              <ShieldCheck size={24} />
            </div>
            <h3 className="feature-title">Privacy-Preserving Deduplication</h3>
            <p className="feature-desc">
              HMAC-SHA256 salted hashing identifies unique visitors accurately without storing invasive raw IP addresses or persistent tracking cookies.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon feature-icon-indigo">
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
            <div className="feature-icon feature-icon-teal">
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
            <div className="feature-icon feature-icon-orange">
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
            <div className="feature-icon feature-icon-pink">
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
            <div className="feature-icon feature-icon-green">
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
            <div className="feature-icon feature-icon-blue">
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
            <div className="feature-icon feature-icon-purple">
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
            <div className="security-header-badge">
              <ShieldCheck size={16} />
              <span>DEFENSIVE ARCHITECTURE</span>
            </div>
            <h2 className="section-title" style={{ fontSize: '2.25rem', marginTop: 14 }}>
              Engineered for Enterprise-Grade Security
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
                Automated filtering rejects dangerous pseudo-schemes (javascript:, data:) with recursive loop prevention and SSRF protection.
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
              <h3 className="security-card-title">PostgreSQL Persistence</h3>
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
        <div className="footer-shell">
          <div className="footer-grid">
            <div className="footer-about">
              <div className="footer-brand">
                <div className="logo-icon">
                  <BrandMark size={19} />
                </div>
                <span>Axly Studio</span>
              </div>
              <p className="footer-tagline">Simple links. Useful tools. Clear insights.</p>
              <p className="footer-support-copy">Need a hand? Contact support:</p>
              <a className="footer-support-email" href="mailto:support@axly.in">
                <Mail size={15} /> support@axly.in
              </a>
            </div>

            <div className="footer-column">
              <h3>Product</h3>
              <a href="#shorten">Shorten a link</a>
              <a href="#qr-codes">QR Code Generator</a>
              <a href="#pages">Public Pages</a>
              <a href="#features">Platform features</a>
              <a href="#security">Security overview</a>
            </div>

            <div className="footer-column">
              <h3>Resources</h3>
              <Link to="/help">Help Center</Link>
              <Link to="/contact">Contact Support</Link>
              <Link to="/report-abuse">Report Abuse</Link>
              <Link to="/security">Security &amp; safety</Link>
              <Link to="/login">Sign in</Link>
            </div>

            <div className="footer-column">
              <h3>Legal</h3>
              <Link to="/terms">Terms &amp; Conditions</Link>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/acceptable-use">Acceptable Use Policy</Link>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Axly Studio. All rights reserved.</p>
            <p>Use Axly responsibly. Review our <Link to="/acceptable-use">Acceptable Use Policy</Link>.</p>
          </div>
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
