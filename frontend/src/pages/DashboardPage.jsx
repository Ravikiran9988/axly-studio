import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Link2, MousePointerClick, TrendingUp, Activity, Plus, QrCode, 
  PanelsTopLeft, BarChart3, ArrowRight, ExternalLink, Copy, Check,
  Sparkles, Layers
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth, api } from '../context/AuthContext';
import CreateLinkModal from '../components/CreateLinkModal';
import LinkCard from '../components/LinkCard';
import GettingStartedChecklist from '../components/GettingStartedChecklist';
import FeatureHelp from '../components/FeatureHelp';
import toast from 'react-hot-toast';

// Generate true zero-click series for the past 7 days when no events exist
const getZeroDaySeries = () => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      clicks: 0,
    };
  });
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, urlsRes] = await Promise.all([
        api.get('/urls/stats'),
        api.get('/urls?limit=5'),
      ]);
      setStats(statsRes.data.data);
      setUrls(urlsRes.data.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  const chartData = stats?.recentClicks?.length > 0
    ? stats.recentClicks.map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        clicks: parseInt(d.clicks, 10) || 0,
      }))
    : getZeroDaySeries();

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  const STAT_CARDS = [
    {
      icon: <Link2 size={18} />,
      label: 'Total Links',
      value: stats?.totalUrls != null ? stats.totalUrls.toLocaleString() : '—',
      color: '#2563eb',
      bg: 'rgba(37, 99, 235, 0.1)',
      meta: `${stats?.activeUrls ?? 0} currently active`,
    },
    {
      icon: <MousePointerClick size={18} />,
      label: 'Total Clicks',
      value: stats?.totalClicks != null ? stats.totalClicks.toLocaleString() : '—',
      color: '#0284c7',
      bg: 'rgba(2, 132, 199, 0.1)',
      meta: 'All-time visitor redirects',
    },
    {
      icon: <Activity size={18} />,
      label: 'Active Links',
      value: stats?.activeUrls != null ? stats.activeUrls.toLocaleString() : '—',
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.1)',
      meta: 'Ready to redirect traffic',
    },
    {
      icon: <TrendingUp size={18} />,
      label: 'Created This Month',
      value: stats?.newThisMonth != null ? stats.newThisMonth.toLocaleString() : '—',
      color: '#7c3aed',
      bg: 'rgba(124, 58, 237, 0.1)',
      meta: 'Calendar month links',
    },
  ];

  const QUICK_ACTIONS = [
    {
      id: 'shorten',
      title: 'Shorten a Link',
      desc: 'Turn a long URL into a shorter, shareable link with optional custom alias.',
      icon: <Link2 size={20} />,
      iconColor: '#2563eb',
      iconBg: 'rgba(37, 99, 235, 0.1)',
      onClick: () => setShowCreate(true),
    },
    {
      id: 'qr',
      title: 'Create a QR Code',
      desc: 'Generate a scannable QR code for any website or marketing short link.',
      icon: <QrCode size={20} />,
      iconColor: '#7c3aed',
      iconBg: 'rgba(124, 58, 237, 0.1)',
      onClick: () => navigate('/app/qr'),
    },
    {
      id: 'pages',
      title: 'Build a Public Page',
      desc: 'Create a single page containing your links, social profiles, and info.',
      icon: <PanelsTopLeft size={20} />,
      iconColor: '#059669',
      iconBg: 'rgba(5, 150, 105, 0.1)',
      onClick: () => navigate('/app/pages'),
    },
    {
      id: 'analytics',
      title: 'View Analytics',
      desc: 'Understand how people interact with your links and published pages.',
      icon: <BarChart3 size={20} />,
      iconColor: '#d97706',
      iconBg: 'rgba(217, 119, 6, 0.1)',
      onClick: () => navigate('/app/analytics'),
    },
  ];

  return (
    <div className="page-container dashboard-page-container">
      {/* Balanced Compact Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              Welcome back, {firstName}
            </h1>
            <FeatureHelp featureKey="shorten" title="Dashboard" />
          </div>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            Manage your links, create pages, and see how your audience engages.
          </p>
        </div>

        {/* Priority Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            id="create-link-btn" 
            className="btn btn-primary" 
            onClick={() => setShowCreate(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Shorten a Link
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/app/qr')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <QrCode size={15} /> Generate QR
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => navigate('/app/pages')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PanelsTopLeft size={15} /> Create Page
          </button>
        </div>
      </div>

      {/* Getting Started Checklist (Dismissible/Collapsible) */}
      <GettingStartedChecklist 
        stats={stats} 
        urls={urls} 
        onCreateLink={() => setShowCreate(true)} 
        onOpenQr={() => navigate('/app/qr')}
      />

      {/* Balanced 4-Column Statistics Grid */}
      <div 
        className="stats-grid" 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {STAT_CARDS.map(card => (
          <div 
            className="stat-card" 
            key={card.label}
            style={{
              padding: '18px 20px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 120,
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div 
                style={{ 
                  width: 36, height: 36, borderRadius: 8, 
                  background: card.bg, color: card.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}
              >
                {card.icon}
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {card.meta}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {loading ? '—' : card.value}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Section: What would you like to do? */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            What would you like to do?
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Quick tools
          </span>
        </div>

        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {QUICK_ACTIONS.map(action => (
            <div
              key={action.id}
              onClick={action.onClick}
              className="card"
              style={{
                padding: '16px 18px',
                cursor: 'pointer',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                transition: 'all 0.18s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') action.onClick(); }}
            >
              <div>
                <div 
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: action.iconBg, color: action.iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 12
                  }}
                >
                  {action.icon}
                </div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                  {action.title}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  {action.desc}
                </p>
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
                Get started <ArrowRight size={13} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7-Day Click Activity Chart */}
      <div 
        className="card chart-card"
        style={{
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Click Activity (Past 7 Days)</h3>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Daily traffic aggregate</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                fontSize: '0.85rem'
              }}
            />
            <Area type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} fill="url(#clickGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Links Section */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Recent Links</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Your latest shortened URLs and recent click metrics
            </p>
          </div>
          <Link to="/app/links" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            View all links <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
          </div>
        ) : urls.length === 0 ? (
          <div className="card empty-state" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div className="empty-icon" style={{ margin: '0 auto 12px', width: 44, height: 44, borderRadius: 12, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Link2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>No links created yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', maxWidth: 420, margin: '0 auto 16px' }}>
              Shorten your first destination URL to start tracking clicks, generating QR codes, and personalizing aliases.
            </p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Shorten Your First Link
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {urls.map(url => (
              <LinkCard key={url.id} url={url} onUpdated={fetchData} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateLinkModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
