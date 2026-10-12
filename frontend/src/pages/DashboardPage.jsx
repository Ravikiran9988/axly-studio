import { useState, useEffect } from 'react';
import { Link2, MousePointerClick, TrendingUp, Activity, Plus, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth, api } from '../context/AuthContext';
import CreateLinkModal from '../components/CreateLinkModal';
import LinkCard from '../components/LinkCard';

const mockChartData = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    clicks: Math.floor(Math.random() * 500) + 50,
  };
});

export default function DashboardPage() {
  const { user } = useAuth();
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

  useEffect(() => { fetchData(); }, []);

  const chartData = stats?.recentClicks?.length > 0
    ? stats.recentClicks.map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        clicks: parseInt(d.clicks),
      }))
    : mockChartData;

  const STAT_CARDS = [
    {
      icon: <Link2 size={20} />,
      label: 'Total Links',
      value: stats?.totalUrls ?? '—',
      color: '#7c3aed',
      bg: 'rgba(124, 58, 237, 0.12)',
      change: `${stats?.activeUrls ?? 0} active`,
    },
    {
      icon: <MousePointerClick size={20} />,
      label: 'Total Clicks',
      value: stats?.totalClicks?.toLocaleString() ?? '—',
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      change: 'All time',
    },
    {
      icon: <TrendingUp size={20} />,
      label: 'New This Month',
      value: stats?.newThisMonth ?? '—',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      change: 'Links created',
    },
    {
      icon: <Activity size={20} />,
      label: 'Active Links',
      value: stats?.activeUrls ?? '—',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      change: 'Currently live',
    },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Dashboard 
            {user?.name && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — Hey, {user.name.split(' ')[0]}! 👋</span>}
          </h1>
          <p className="page-subtitle">Here's what's happening with your links today.</p>
        </div>
        <button id="create-link-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create Link
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {STAT_CARDS.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
              {card.icon}
            </div>
            {loading ? (
              <>
                <div className="skeleton" style={{ height: 36, width: 80, marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 16, width: 60 }} />
              </>
            ) : (
              <>
                <div className="stat-value">{card.value}</div>
                <div className="stat-label">{card.label}</div>
                <div className="stat-change positive" style={{ marginTop: 6 }}>{card.change}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="chart-card" style={{ marginBottom: 28 }}>
        <div className="chart-title">
          <TrendingUp size={16} /> Clicks Over Last 7 Days
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 8, fontSize: '0.85rem',
              }}
              labelStyle={{ color: 'var(--text-primary)' }}
              itemStyle={{ color: '#7c3aed' }}
            />
            <Area type="monotone" dataKey="clicks" stroke="#7c3aed" strokeWidth={2} fill="url(#clickGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Links */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Recent Links</h2>
        <Link to="/links" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-primary)', fontSize: '0.875rem', fontWeight: 500 }}>
          View all <ArrowUpRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
          ))}
        </div>
      ) : urls.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔗</div>
          <div className="empty-title">No links yet</div>
          <div className="empty-desc">Create your first short link to get started</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create your first link
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {urls.map(url => (
            <LinkCard key={url.id} url={url} onUpdated={fetchData} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateLinkModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchData(); }}
        />
      )}
    </div>
  );
}
