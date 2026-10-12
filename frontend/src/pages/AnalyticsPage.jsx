import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import {
  ArrowLeft, Globe, Globe2, Smartphone, Monitor, Copy, Check, ExternalLink, QrCode,
  TrendingUp, MousePointerClick, Users, Clock,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import QRModal from '../components/QRModal';
import toast from 'react-hot-toast';

const COLORS = ['#7c3aed', '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];

const DEVICE_ICONS = {
  desktop: <Monitor size={14} />,
  mobile: <Smartphone size={14} />,
  tablet: <Smartphone size={14} />,
};

export default function AnalyticsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/urls/${id}/analytics?days=${days}`);
        setData(res.data.data);
      } catch (err) {
        toast.error('Failed to load analytics');
        navigate('/app/links');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, days]);

  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.url.short_url);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="skeleton" style={{ height: 100, borderRadius: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
          </div>
          <div className="skeleton" style={{ height: 260, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { url, analytics } = data;

  // Calculate device percentages for pie chart
  const totalDeviceClicks = analytics.byDevice.reduce((s, d) => s + parseInt(d.clicks), 0);
  const deviceData = analytics.byDevice.map(d => ({
    name: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    value: parseInt(d.clicks),
    pct: totalDeviceClicks > 0 ? Math.round((parseInt(d.clicks) / totalDeviceClicks) * 100) : 0,
  }));

  return (
    <div className="page-container">
      {/* Back + Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/app/links')}
          style={{ marginBottom: 16, paddingLeft: 0 }}
        >
          <ArrowLeft size={16} /> Back to Links
        </button>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Short URL</div>
              <a
                href={url.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="url-short"
                style={{ fontSize: '1.1rem', fontWeight: 700 }}
              >
                {url.short_url}
              </a>
              <div className="url-original" style={{ marginTop: 6, maxWidth: '100%' }}>
                {url.original_url}
              </div>
              {url.title && (
                <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {url.title}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
              <a href={url.short_url} target="_blank" rel="noopener noreferrer" className="copy-btn">
                <ExternalLink size={13} /> Open
              </a>
              <button className="copy-btn" onClick={() => setShowQr(true)}>
                <QrCode size={13} /> QR Code
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Day Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDays(d)}
            id={`days-${d}`}
          >
            {d} days
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { icon: <MousePointerClick size={20} />, label: 'Total Clicks', value: analytics.totalClicks.toLocaleString(), color: '#2563eb', bg: '#eff6ff' },
          { icon: <Users size={20} />, label: 'Unique Clicks', value: analytics.uniqueClicks.toLocaleString(), color: '#0284c7', bg: '#f0f9ff' },
          { icon: <Globe size={20} />, label: 'Countries', value: analytics.byCountry.length, color: '#059669', bg: '#ecfdf5' },
          { icon: <Clock size={20} />, label: 'Created', value: new Date(url.created_at).toLocaleDateString(), color: '#d97706', bg: '#fffbeb' },
        ].map(card => (
          <div className="stat-card" key={card.label}>
            <div className="stat-icon" style={{ background: card.bg, color: card.color }}>{card.icon}</div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Clicks Over Time Chart */}
      <div className="chart-card" style={{ marginBottom: 20 }}>
        <div className="chart-title"><TrendingUp size={16} /> Clicks Over Time</div>
        {analytics.dailyClicks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No click data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.dailyClicks.map(d => ({
              date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              clicks: parseInt(d.clicks),
            }))}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.85rem' }} />
              <Area type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} fill="url(#aGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Grid */}
      <div className="analytics-grid">
        {/* Countries */}
        <div className="chart-card">
          <div className="chart-title"><Globe size={16} /> Top Countries</div>
          {analytics.byCountry.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {analytics.byCountry.slice(0, 7).map((c, i) => {
                const max = parseInt(analytics.byCountry[0].clicks);
                const pct = Math.round((parseInt(c.clicks) / max) * 100);
                return (
                  <div key={c.country}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.country}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{parseInt(c.clicks).toLocaleString()}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Device Split */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="chart-card">
            <div className="chart-title"><Monitor size={16} /> Devices</div>
            {deviceData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={deviceData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                      {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {deviceData.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Browsers */}
          <div className="chart-card">
            <div className="chart-title"><Globe2 size={16} /> Browsers</div>
            {analytics.byBrowser.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analytics.byBrowser.slice(0, 5).map((b, i) => {
                  const max = parseInt(analytics.byBrowser[0].clicks);
                  const pct = Math.round((parseInt(b.clicks) / max) * 100);
                  return (
                    <div key={b.browser}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{b.browser}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{b.clicks}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showQr && <QRModal urlId={id} onClose={() => setShowQr(false)} />}
    </div>
  );
}
