import { useState } from 'react';
import { HelpCircle, X, ExternalLink, BookOpen, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FEATURE_EXPLANATIONS = {
  shorten: {
    title: 'Short Links & Custom Aliases',
    what: 'Turn long, unwieldy URLs into compact, memorable links that redirect visitors instantaneously.',
    why: 'Short links look cleaner in marketing messages, fit within character limits, and let you measure engagement.',
    how: [
      'Enter your destination URL (e.g., https://example.com/summer-sale).',
      'Optionally choose a recognizable custom alias (e.g., summer-sale) or let Axly generate one automatically.',
      'Click "Shorten URL" and copy your link to share on social media, email, or print.'
    ],
    example: 'Long URL: https://myshop.com/products/outdoor/hiking-backpack-v2\nShort link: s.axly.in/backpack',
    helpAnchor: 'short-links'
  },
  qr: {
    title: 'QR Code Generator',
    what: 'Convert any URL, short link, or text into a high-contrast, scannable QR code image.',
    why: 'Bridge offline and online campaigns. Anyone with a smartphone camera can scan it to instantly open your destination.',
    how: [
      'Enter or paste the website URL you want to encode.',
      'Select a color preset or custom hex color, and choose your preferred resolution.',
      'Download your code in high-resolution PNG or vector SVG format for printing.'
    ],
    example: 'Generate a QR code pointing to s.axly.in/menu to place on physical restaurant table cards.',
    helpAnchor: 'qr-codes'
  },
  pages: {
    title: 'Public Profile Pages',
    what: 'Create a customizable, single-page website to showcase your links, portfolio, videos, and contact information.',
    why: 'Replace multiple disjointed links with one polished page for your social media bios and personal branding.',
    how: [
      'Choose a starting template (Link in Bio, Creator, Developer, Business, or Business Card).',
      'Choose your public address (e.g. studio.axly.in/p/yourname).',
      'Add link buttons, social profiles, images, and lead capture forms, then publish.'
    ],
    example: 'studio.axly.in/p/alex — A centralized hub with your resume, portfolio links, and booking calendar.',
    helpAnchor: 'public-pages'
  },
  domains: {
    title: 'Custom Branded Domains',
    what: 'Connect your own registered domain name (e.g., links.mybrand.com) to your Axly short links or public pages.',
    why: 'Reinforce trust and increase click-through rates by displaying your brand name in every link you share.',
    how: [
      'Add your domain in the Domains section.',
      'Add the displayed TXT or CNAME record to your DNS host (e.g., Cloudflare, Namecheap, GoDaddy).',
      'Click Verify Domain once DNS propagation completes.'
    ],
    example: 'Instead of s.axly.in/promo, share links.yourcompany.com/promo.',
    helpAnchor: 'custom-domains'
  },
  campaigns: {
    title: 'Campaigns & UTM Tracking',
    what: 'Organize related links under marketing campaigns with standardized UTM tracking parameters.',
    why: 'Know exactly which channel (e.g., newsletter, Google ad, Twitter post) drove every click and conversion in Google Analytics.',
    how: [
      'Create a campaign name (e.g., Summer Launch 2026).',
      'Define utm_source, utm_medium, and utm_campaign parameters.',
      'Axly automatically attaches tracking tags to your shortened destination.'
    ],
    example: 'https://mysite.com?utm_source=twitter&utm_medium=social&utm_campaign=summer_sale',
    helpAnchor: 'campaigns-utm'
  },
  experiments: {
    title: 'A/B Link Experiments',
    what: 'Distribute incoming clicks across two or more landing page destinations based on percentage weights.',
    why: 'Compare how different headline variations, layouts, or pricing models perform before committing to one.',
    how: [
      'Specify your control URL (Variant A) and challenger URL (Variant B).',
      'Assign traffic split percentages (e.g., 50% / 50%).',
      'Share your single Axly short link; Axly randomly routes visitors according to your weights.'
    ],
    example: '50% of clicks route to /checkout-simple, and 50% route to /checkout-extended.',
    helpAnchor: 'ab-experiments'
  },
  analytics: {
    title: 'Link & Visitor Analytics',
    what: 'Comprehensive metrics tracking total clicks, unique visitors, referrers, device types, and operating systems.',
    why: 'Discover when your audience is active, where traffic originates, and which platforms yield the highest engagement.',
    how: [
      'Click on any link in My Links or open Account Analytics.',
      'Review total versus unique visitors, device distributions, and geographic charts.',
      'Filter by time range (7 days, 30 days, or all time).'
    ],
    example: 'See that 70% of your audience clicks from mobile devices via Instagram.',
    helpAnchor: 'link-analytics'
  },
  teams: {
    title: 'Teams & Workspaces',
    what: 'Create isolated workspaces and invite collaborators with fine-grained access permissions.',
    why: 'Collaborate with marketing teams, clients, and colleagues without sharing personal account credentials.',
    how: [
      'Create a shared workspace for your organization or client project.',
      'Invite members by email with Owner, Admin, Member, or Viewer roles.',
      'Organize team links, campaigns, and pages collaboratively.'
    ],
    example: 'Marketing team collaborates on quarterly campaign links while billing stays managed by the Owner.',
    helpAnchor: 'teams-workspaces'
  },
  developer: {
    title: 'Developer Platform & API',
    what: 'Programmatic REST API keys and secure webhooks for automating link generation and analytics.',
    why: 'Shorten links inside your existing CMS, e-commerce checkout, or automated marketing workflows.',
    how: [
      'Generate a scoped API Key under Developer Tools.',
      'Send authenticated POST requests to /api/urls with your Bearer token.',
      'Register webhooks to receive real-time POST events on link clicks.'
    ],
    example: 'curl -H "Authorization: Bearer axly_..." -d \'{"url":"https://example.com"}\' https://api.axly.in/api/urls',
    helpAnchor: 'developer-tools'
  },
  bulk: {
    title: 'Bulk Import & Export Tools',
    what: 'Generate dozens or hundreds of short links simultaneously by uploading a CSV spreadsheet, or export your entire link library.',
    why: 'Save hours of manual data entry when migrating from another shortening service, launching catalog links, or conducting audits.',
    how: [
      'Download our official sample CSV template.',
      'Fill in destination original_url, optional title, custom_alias, and tags.',
      'Upload your CSV, review the preview and validation warnings, then click Import.'
    ],
    example: 'Upload a 100-row catalog CSV to instantly generate short links for your entire product catalog.',
    helpAnchor: 'bulk-import'
  }
};

export default function FeatureHelp({ featureKey, title, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const info = FEATURE_EXPLANATIONS[featureKey] || {
    title: title || 'Feature Guidance',
    what: 'Learn how to get the most out of this Axly Studio tool.',
    why: 'Axly Studio simplifies link management and audience reach.',
    how: ['Review the settings on this page.', 'Configure your inputs and click save.'],
    example: 'Use this feature to scale your digital presence.',
    helpAnchor: ''
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`feature-help-btn ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          padding: 0,
        }}
        title={`Learn how ${info.title} works`}
        aria-label={`Help for ${info.title}`}
      >
        <HelpCircle size={15} />
      </button>

      {isOpen && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className="modal" style={{ maxWidth: 520, padding: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'rgba(37,99,235,0.1)', color: 'var(--brand-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Lightbulb size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{info.title}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contextual Feature Guide</div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: 4, borderRadius: 6
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* What it does */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 4 }}>
                What does it do?
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                {info.what}
              </p>
            </div>

            {/* Why use it */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 4 }}>
                Why use it?
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {info.why}
              </p>
            </div>

            {/* How to use it */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 6 }}>
                How to use it:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {info.how.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: 3 }}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Example */}
            {info.example && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: 20
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>Example: </strong>
                <pre style={{ margin: '4px 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--brand-primary)' }}>
                  {info.example}
                </pre>
              </div>
            )}

            {/* Footer with full documentation link */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
              <Link 
                to={info.helpAnchor ? `/app/help#${info.helpAnchor}` : '/app/help'}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '0.82rem', color: 'var(--brand-primary)', fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <BookOpen size={14} /> Full Knowledge Base Guide <ExternalLink size={12} />
              </Link>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setIsOpen(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
