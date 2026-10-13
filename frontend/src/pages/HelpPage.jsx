import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, BookOpen, ExternalLink, HelpCircle, Sparkles,
  Link2, QrCode, PanelsTopLeft, Globe, Megaphone,
  GitCompare, BarChart3, Users, Code2, Shield, ArrowRight,
  ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

const HELP_CATEGORIES = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    icon: Sparkles,
    articles: [
      {
        id: 'overview',
        title: 'Welcome to Axly Studio',
        what: 'Axly Studio is an enterprise-grade URL shortening, digital presence, and audience engagement platform.',
        when: 'Ideal for creators, marketers, developers, and businesses wanting clean links, scannable QR codes, and custom-branded bio pages.',
        steps: [
          'Use the URL shortener on your Dashboard or homepage to turn any long link into a concise URL.',
          'Customize your link ending (vanity alias) to make it memorable.',
          'Generate high-resolution vector and PNG QR codes for marketing material.',
          'Build a public profile page under url.axly.in/p/username to house all your content.'
        ],
        example: 'Convert https://example.com/products/summer-clearance into s.axly.in/summer and track clicks in real time.',
        mistakes: [
          { error: 'Entering incomplete URLs', solution: 'Always include the protocol like https:// when pasting your long destination link.' },
          { error: 'Confusing public pages with account settings', solution: 'Public Profile Pages are shareable portfolios for visitors, whereas Account Profile is private settings.' }
        ],
        actionLink: '/app/dashboard',
        actionLabel: 'Go to Dashboard'
      }
    ]
  },
  {
    id: 'short-links',
    name: 'Short Links & Custom Aliases',
    icon: Link2,
    articles: [
      {
        id: 'custom-alias',
        title: 'Choosing and Using Custom Aliases',
        what: 'A custom alias lets you personalize the ending of your short link instead of using a randomly generated code.',
        when: 'Useful when sharing links verbally, in social media bios, podcasts, or advertisements where brand recognition matters.',
        steps: [
          'Click "Create Link" on the Dashboard or in My Links.',
          'Paste your destination URL.',
          'Select "Customize link" and enter your preferred alias (letters, numbers, hyphens, underscores).',
          'Review the live preview (e.g. s.axly.in/summer-sale) and click Shorten.'
        ],
        example: 'Random short code: s.axly.in/x8k2q\nCustom alias: s.axly.in/summer-sale',
        mistakes: [
          { error: 'Using spaces or special symbols', solution: 'Only use letters, numbers, hyphens, and underscores between 3 and 30 characters.' },
          { error: 'Alias already in use', solution: 'Aliases are globally unique on s.axly.in. If taken, try appending your brand or year (e.g. acme-sale-2026).' }
        ],
        actionLink: '/app/links',
        actionLabel: 'Open My Links'
      },
      {
        id: 'link-expiration',
        title: 'Setting Link Expiration & Status Controls',
        what: 'Define an exact date after which a link will automatically stop redirecting visitors, or pause links on demand.',
        when: 'Essential for limited-time promotions, flash sales, seasonal events, or embargoed product launches.',
        steps: [
          'When creating or editing a link, toggle or select the Expiration Date field.',
          'Pick your desired cutoff date in the calendar selector.',
          'After expiration, visitors will see an expired link notice instead of a 404.'
        ],
        example: 'Set s.axly.in/flashsale to expire at midnight on Sunday.',
        mistakes: [
          { error: 'Setting a past expiration date', solution: 'Always pick a future date. The form automatically validates against past dates.' }
        ],
        actionLink: '/app/links',
        actionLabel: 'Manage Links'
      }
    ]
  },
  {
    id: 'qr-codes',
    name: 'QR Code Generator',
    icon: QrCode,
    articles: [
      {
        id: 'qr-generator',
        title: 'Generating and Customizing QR Codes',
        what: 'Transform any web address or short URL into a scannable QR code image.',
        when: 'Perfect for business cards, restaurant menus, flyers, product packaging, billboard ads, and presentation slides.',
        steps: [
          'Navigate to QR Codes in the sidebar.',
          'Paste any URL directly—you do not have to create an Axly short link first.',
          'Pick a color preset or custom hex color to match your brand style.',
          'Choose your export resolution (256px, 512px, or 1024px) and download as PNG or SVG.'
        ],
        example: 'Create a high-contrast dark slate QR code pointing to your digital business card for conference networking.',
        mistakes: [
          { error: 'Low contrast between foreground and background', solution: 'Ensure the QR foreground is significantly darker than the background so cameras scan reliably.' },
          { error: 'Expecting a printed static QR code to change destinations', solution: 'To change destinations after printing, point the QR code to an Axly short link, which can be edited anytime.' }
        ],
        actionLink: '/app/qr',
        actionLabel: 'Open QR Generator'
      }
    ]
  },
  {
    id: 'public-pages',
    name: 'Public Profile Pages',
    icon: PanelsTopLeft,
    articles: [
      {
        id: 'pages-guide',
        title: 'Building a Link-in-Bio & Portfolio Page',
        what: 'Create a single, beautifully styled webpage containing all your social profiles, links, projects, and contact info.',
        when: 'Ideal for Instagram and TikTok bio links, creator channels, freelance portfolios, and digital business cards.',
        steps: [
          'Open "My Pages" in the sidebar and click "Create Page".',
          'Choose a template (Link in Bio, Creator, Developer Portfolio, Business, or Business Card).',
          'Pick your public address (e.g., url.axly.in/p/yourname).',
          'Add blocks such as links, social profiles, images, video embeds, and lead forms, then click Publish.'
        ],
        example: 'url.axly.in/p/alex — A central destination showing Alex’s podcast, design portfolio, YouTube channel, and contact email.',
        mistakes: [
          { error: 'Confusing page username with custom domain', solution: 'Page username gives you an Axly address like url.axly.in/p/username. To use your own standalone domain (yourbrand.com), connect it in Domains.' },
          { error: 'Forgetting to publish', solution: 'Draft pages are only visible in preview mode. Click "Publish" when you are ready for visitors to access it.' }
        ],
        actionLink: '/app/pages',
        actionLabel: 'Open My Pages'
      }
    ]
  },
  {
    id: 'custom-domains',
    name: 'Custom Domains',
    icon: Globe,
    articles: [
      {
        id: 'domains-guide',
        title: 'Connecting Your Own Branded Domain',
        what: 'Brand your short links or public pages with a domain you own (e.g. links.mybrand.com).',
        when: 'When you want maximum brand credibility, higher click-through rates, and enterprise-grade white-labeling.',
        steps: [
          'Go to "Domains" under Manage in the sidebar.',
          'Click "Add Domain" and enter your hostname (e.g. links.company.com).',
          'Log in to your DNS provider (Cloudflare, GoDaddy, Route53, etc.) and add the displayed DNS TXT verification token.',
          'Click "Verify Domain" once your DNS records propagate.'
        ],
        example: 'Replace s.axly.in/hire with go.acme.corp/hire.',
        mistakes: [
          { error: 'Adding protocol in domain name', solution: 'Enter just the hostname like links.mybrand.com, not https://links.mybrand.com.' },
          { error: 'Instant verification expectation', solution: 'DNS records can take a few minutes to propagate across global nameservers.' }
        ],
        actionLink: '/app/domains',
        actionLabel: 'Manage Domains'
      }
    ]
  },
  {
    id: 'campaigns-utm',
    name: 'Campaigns and UTM Tracking',
    icon: Megaphone,
    articles: [
      {
        id: 'campaigns-guide',
        title: 'Organizing Marketing Links with UTM Parameters',
        what: 'Standardize campaign names and UTM tags (source, medium, campaign) across all links you share.',
        when: 'When running paid ad campaigns, email newsletters, influencer sponsorships, or multi-channel product launches.',
        steps: [
          'Go to "Campaigns & UTM" in the sidebar.',
          'Create a campaign (e.g., Black Friday 2026).',
          'Use the UTM Builder to generate links with utm_source, utm_medium, and utm_campaign preset.',
          'Review aggregated click performance for the entire campaign in one dashboard.'
        ],
        example: 's.axly.in/promo opens destination with ?utm_source=newsletter&utm_medium=email&utm_campaign=black_friday.',
        mistakes: [
          { error: 'Inconsistent naming conventions', solution: 'Use lowercase names and underscores (e.g. utm_source=google_ads) so your analytics stay clean.' }
        ],
        actionLink: '/app/campaigns',
        actionLabel: 'Open Campaigns'
      }
    ]
  },
  {
    id: 'ab-experiments',
    name: 'A/B Experiments',
    icon: GitCompare,
    articles: [
      {
        id: 'ab-guide',
        title: 'Setting Up A/B Destination Split Testing',
        what: 'Split incoming clicks between two or more destination URLs with custom traffic percentage weights.',
        when: 'When testing conversion rates between a concise landing page vs. a long-form sales page, or different promotional offers.',
        steps: [
          'Select a link in My Links and click "A/B Experiments".',
          'Add Variant A (Control) and Variant B (Challenger) destination URLs.',
          'Set traffic weights (e.g., 50% / 50%).',
          'Share your short link and monitor click traffic split evenly across both variations.'
        ],
        example: 'Send 50% of visitors to pricing page A ($19/mo) and 50% to pricing page B ($29/mo).',
        mistakes: [
          { error: 'Total weights not equal to 100%', solution: 'Ensure the sum of all variant weights equals 100%.' }
        ],
        actionLink: '/app/experiments',
        actionLabel: 'Explore Experiments'
      }
    ]
  },
  {
    id: 'link-analytics',
    name: 'Link and Page Analytics',
    icon: BarChart3,
    articles: [
      {
        id: 'analytics-guide',
        title: 'Understanding Clicks, Visitors, and Referrers',
        what: 'Real-time performance metrics showing clicks, unique visitors, devices, browsers, and referrers.',
        when: 'To measure ROI on marketing campaigns, identify top traffic sources, and optimize publishing times.',
        steps: [
          'Open "Account Analytics" or click the analytics icon on any link card.',
          'Review the past 7 days, 30 days, or all-time click graphs.',
          'Examine the Referrers table to see which platforms (Google, Twitter, LinkedIn) sent the most visitors.',
          'Inspect Device breakdown (Mobile vs Desktop) to ensure destinations are responsive.'
        ],
        example: 'Identify that 80% of your webinar signups came from LinkedIn referrals on Tuesday afternoon.',
        mistakes: [
          { error: 'Confusing Total Clicks with Unique Visitors', solution: 'Total Clicks records every redirect event; Unique Visitors counts deduplicated individual people.' }
        ],
        actionLink: '/app/analytics',
        actionLabel: 'View Analytics'
      }
    ]
  },
  {
    id: 'teams-workspaces',
    name: 'Teams and Workspaces',
    icon: Users,
    articles: [
      {
        id: 'teams-guide',
        title: 'Collaborating in Shared Workspaces',
        what: 'Invite team members to shared workspaces with role-based access control (Owner, Admin, Member, Viewer).',
        when: 'When collaborating with agency clients, marketing teams, or cross-functional departments.',
        steps: [
          'Navigate to "Teams & Workspaces" in the sidebar.',
          'Create a workspace for your team or client project.',
          'Invite members by email and assign their role.',
          'Organize and manage links and campaigns collaboratively.'
        ],
        example: 'Invite an agency contractor as a "Member" so they can create campaign links without seeing billing details.',
        mistakes: [
          { error: 'Assigning Admin role when Viewer is sufficient', solution: 'Use the Viewer role for stakeholders who only need to monitor click stats.' }
        ],
        actionLink: '/app/teams',
        actionLabel: 'Open Teams'
      }
    ]
  },
  {
    id: 'developer-tools',
    name: 'Developer Tools & API',
    icon: Code2,
    articles: [
      {
        id: 'dev-guide',
        title: 'API Keys and Webhook Integrations',
        what: 'Automate link creation, QR generation, and click reporting through REST API endpoints.',
        when: 'When building automated links in your custom CMS, CRM pipelines, mobile apps, or e-commerce checkouts.',
        steps: [
          'Open "Developer Tools" in the sidebar.',
          'Generate a secret API Key with your required scopes (e.g. urls:create, urls:read).',
          'Include the key in your HTTP Authorization header: Authorization: Bearer axly_...',
          'Configure SSRF-safe webhooks to receive real-time notifications on click events.'
        ],
        example: 'Automate short link creation whenever a new blog post is published in WordPress.',
        mistakes: [
          { error: 'Exposing API keys in client-side code', solution: 'Always store Axly API keys in server-side environment variables.' }
        ],
        actionLink: '/app/developer',
        actionLabel: 'Developer Tools'
      }
    ]
  },
  {
    id: 'account-security',
    name: 'Account & Security',
    icon: Shield,
    articles: [
      {
        id: 'security-guide',
        title: 'Profile Settings, Passwords, and Data Privacy',
        what: 'Manage your personal account credentials, export your link data archive, or configure security.',
        when: 'To keep your account secure, change your email, or download compliance backups.',
        steps: [
          'Go to "My Profile" to update your display name and email address.',
          'Go to "Settings" to switch between light and dark themes.',
          'Export your complete account history as machine-readable JSON under Settings.'
        ],
        example: 'Download a quarterly JSON archive of all active links and click totals for audit records.',
        mistakes: [
          { error: 'Confusing My Profile with My Pages', solution: 'My Profile is your private account management; My Pages creates public websites for visitors.' }
        ],
        actionLink: '/app/profile',
        actionLabel: 'My Account Profile'
      }
    ]
  }
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedArticles, setExpandedArticles] = useState({});

  const toggleArticle = (id) => {
    setExpandedArticles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const resetChecklist = () => {
    localStorage.removeItem('axly_checklist_dismissed');
    localStorage.removeItem('axly_checklist_collapsed');
    toast.success('Getting Started checklist restored to Dashboard.');
  };

  // Filter categories and articles by search query
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      if (selectedCategory === 'all') return HELP_CATEGORIES;
      return HELP_CATEGORIES.filter(c => c.id === selectedCategory);
    }

    return HELP_CATEGORIES.map(category => {
      const matchingArticles = category.articles.filter(article => 
        article.title.toLowerCase().includes(q) ||
        article.what.toLowerCase().includes(q) ||
        article.when.toLowerCase().includes(q) ||
        article.example.toLowerCase().includes(q) ||
        category.name.toLowerCase().includes(q)
      );
      if (matchingArticles.length > 0) {
        return { ...category, articles: matchingArticles };
      }
      return null;
    }).filter(Boolean);
  }, [searchQuery, selectedCategory]);

  return (
    <div className="page-container" style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--brand-primary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            <BookOpen size={14} /> Knowledge Base &amp; Guides
          </div>
          <h1 className="page-title">Help &amp; Learning Center</h1>
          <p className="page-subtitle">
            Clear, step-by-step guides to help you master every link, QR code, page, and domain tool in Axly Studio.
          </p>
        </div>

        <button 
          type="button" 
          onClick={resetChecklist} 
          className="btn btn-secondary btn-sm"
          title="Reopen onboarding guide on the dashboard"
        >
          <RotateCcw size={14} /> Reopen Dashboard Checklist
        </button>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: 46, paddingRight: 16, height: 48, fontSize: '0.95rem', borderRadius: 'var(--radius-lg)' }}
          placeholder="Search guides (e.g. 'how to choose a custom alias', 'QR code', 'connect domain', 'public page')..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 28, scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid ' + (selectedCategory === 'all' ? 'var(--brand-primary)' : 'var(--border-color)'),
            background: selectedCategory === 'all' ? 'var(--brand-primary)' : 'var(--bg-card)',
            color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          All Topics ({HELP_CATEGORIES.reduce((s, c) => s + c.articles.length, 0)})
        </button>
        {HELP_CATEGORIES.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid ' + (selectedCategory === category.id ? 'var(--brand-primary)' : 'var(--border-color)'),
              background: selectedCategory === category.id ? 'var(--brand-primary)' : 'var(--bg-card)',
              color: selectedCategory === category.id ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Guide Content */}
      {filteredData.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <HelpCircle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>No guides matched your search</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 440, margin: '0 auto 16px' }}>
            Try searching for terms like "alias", "QR", "public page", "domain", or "analytics".
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => setSearchQuery('')}>
            Clear Search
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {filteredData.map(category => {
            const Icon = category.icon;
            return (
              <section key={category.id} id={category.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(37,99,235,0.08)', color: 'var(--brand-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={18} />
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                    {category.name}
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {category.articles.map(article => {
                    const isExpanded = expandedArticles[article.id] !== false; // expanded by default
                    return (
                      <div 
                        key={article.id}
                        className="card"
                        style={{ padding: '20px 24px', transition: 'all 0.2s ease' }}
                      >
                        <div 
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          onClick={() => toggleArticle(article.id)}
                        >
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            {article.title}
                          </h3>
                          <button 
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: 16 }}>
                            {/* What it is */}
                            <div style={{ marginBottom: 12 }}>
                              <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--brand-primary)', display: 'block', marginBottom: 2 }}>
                                What is this feature?
                              </strong>
                              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                                {article.what}
                              </p>
                            </div>

                            {/* When it is useful */}
                            <div style={{ marginBottom: 14 }}>
                              <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--brand-primary)', display: 'block', marginBottom: 2 }}>
                                Why &amp; when would I use it?
                              </strong>
                              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                {article.when}
                              </p>
                            </div>

                            {/* Step-by-step usage instructions */}
                            <div style={{ marginBottom: 14 }}>
                              <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--brand-primary)', display: 'block', marginBottom: 6 }}>
                                Step-by-Step Instructions:
                              </strong>
                              <ol style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {article.steps.map((s, idx) => (
                                  <li key={idx} style={{ marginBottom: 4 }}>{s}</li>
                                ))}
                              </ol>
                            </div>

                            {/* Concrete example */}
                            {article.example && (
                              <div style={{
                                padding: '12px 14px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.82rem',
                                color: 'var(--text-secondary)',
                                marginBottom: 16
                              }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Concrete Example:</strong>
                                <pre style={{ margin: '4px 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--brand-primary)' }}>
                                  {article.example}
                                </pre>
                              </div>
                            )}

                            {/* Common mistakes and solutions */}
                            {article.mistakes && article.mistakes.length > 0 && (
                              <div style={{ marginBottom: 18 }}>
                                <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#ea580c', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                  <AlertTriangle size={14} /> Common Mistakes &amp; Fixes:
                                </strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {article.mistakes.map((m, idx) => (
                                    <div key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: 12, borderLeft: '2px solid rgba(234,88,12,0.3)' }}>
                                      <strong style={{ color: 'var(--text-primary)' }}>{m.error}: </strong>
                                      <span>{m.solution}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Direct Action Link */}
                            {article.actionLink && (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                                <Link to={article.actionLink} className="btn btn-primary btn-sm">
                                  {article.actionLabel || 'Open Feature'} <ArrowRight size={14} />
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
