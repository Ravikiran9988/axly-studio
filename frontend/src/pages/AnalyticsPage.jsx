import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  ArrowLeft, Globe, Globe2, Smartphone, Monitor, Copy, Check,
  ExternalLink, QrCode, TrendingUp, MousePointerClick, Users,
  Clock, Download, Shield, Laptop, Layers,
} from 'lucide-react';
import { api } from '../context/AuthContext';
import QRModal from '../components/QRModal';
import toast from 'react-hot-toast';

const COLORS = ['#2563eb', '#0284c7', '#0d9488', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

export default function AnalyticsPage() {
  const { id } = useParams(); // If id exists -> Single Link mode. If not -> Account-wide mode.
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const isAccountMode = !id;

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      if (isAccountMode) {
        const res = await api.get(`/analytics?days=${days}`);
        setData({
          isAccount: true,
          summary: res.data.data.summary,
          dailyClicks: res.data.data.dailyClicks || [],
          byReferer: res.data.data.byReferer || [],
          byDevice: res.data.data.byDevice || [],
          byBrowser: res.data.data.byBrowser || [],
          byOs: res.data.data.byOs || [],
          byCountry: res.data.data.byCountry || [],
        });
      } else {
        const res = await api.get(`/urls/${id}/analytics?days=${days}`);
        setData({
          isAccount: false,
          url: res.data.data.url,
          summary: {
            totalClicks: res.data.data.analytics.totalClicks,
            uniqueVisitors: res.data.data.analytics.uniqueClicks,
          },
          dailyClicks: res.data.data.analytics.dailyClicks || [],
          byReferer: res.data.data.analytics.byReferer || [],
          byDevice: res.data.data.analytics.byDevice || [],
          byBrowser: res.data.data.analytics.byBrowser || [],
          byCountry: res.data.data.analytics.byCountry || [],
        });
      }
    } catch {
      toast.error('Failed to load analytics metrics');
      if (!isAccountMode) navigate('/app/links');
    } finally {
      setLoading(false);
    }
  }, [id, days, isAccountMode, navigate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleCopy = async () => {
    if (!data?.url) return;
    await navigator.clipboard.writeText(data.url.short_url);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = async () => {
    try {
      const endpoint = isAccountMode
        ? `/analytics/export/csv?days=${days}`
        : `/urls/${id}/export/csv`;

      const res = await api.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = isAccountMode
        ? `account-analytics-${days}d.csv`
        : `link-${id}-analytics.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Analytics CSV exported!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />)}
          </div>
          <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Pie chart calculation
  const totalDeviceClicks = data.byDevice.reduce((s, d) => s + parseInt(d.clicks || 0, 10), 0);
  const deviceData = data.byDevice.map(d => ({
    name: (d.device || 'Desktop').charAt(0).toUpperCase() + (d.device || 'desktop').slice(1),
    value: parseInt(d.clicks || 0, 10),
    pct: totalDeviceClicks > 0 ? Math.round((parseInt(d.clicks || 0, 10) / totalDeviceClicks) * 100) : 0,
  }));

  return (
    <div className="page-container">
      {/* Header & Mode Switch */}
      <div style={{ marginBottom: 20 }}>
        {!isAccountMode ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/app/links')}
            style={{ marginBottom: 14, paddingLeft: 0 }}
          >
            <ArrowLeft size={16} /> Back to My Links
          </button>
        ) : null}

        {/* Title & Info Banner */}
        <div className="card" style={{ padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge badge-active">
                  {isAccountMode ? 'Account-Wide Analytics' : 'Link-Level Analytics'}
                </span>
                <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  Real PostgreSQL Events Only
                </span>
              </div>

              {isAccountMode ? (
                <>
                  <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                    Portfolio Traffic Intelligence
                  </h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Aggregated analytics across all short links in your workspace.
                  </p>
                </>
              ) : (
                <>
                  <a
                    href={data.url.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="url-short"
                    style={{ fontSize: '1.25rem', fontWeight: 800 }}
                  >
                    {data.url.short_url}
                  </a>
                  <div className="url-original" style={{ marginTop: 4, maxWidth: '100%' }}>
                    {data.url.original_url}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
                <Download size={14} /> Export CSV
              </button>
              {!isAccountMode && (
                <>
                  <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                    {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                  <a href={data.url.short_url} target="_blank" rel="noopener noreferrer" className="copy-btn">
                    <ExternalLink size={13} /> Open
                  </a>
                  <button className="copy-btn" onClick={() => setShowQr(true)}>
                    <QrCode size={13} /> QR
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDays(d)}
            >
              Last {d} days
            </button>
          ))}
        </div>

        {/* Privacy Disclosure Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: '0.75rem', color: 'var(--text-muted)',
          background: 'var(--bg-secondary)', padding: '6px 12px',
          borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)',
        }}>
          <Shield size={12} color="#10b981" />
          <span>Privacy-Preserving Visitor Hashes · No Raw IP Storage</span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          {
            icon: <MousePointerClick size={20} />,
            label: 'Total Clicks',
            value: parseInt(data.summary.totalClicks || 0, 10).toLocaleString(),
            color: '#2563eb',
            bg: 'rgba(37, 99, 235, 0.08)',
          },
          {
            icon: <Users size={20} />,
            label: 'Unique Visitors',
            value: parseInt(data.summary.uniqueVisitors || 0, 10).toLocaleString(),
            color: '#0284c7',
            bg: 'rgba(2, 132, 199, 0.08)',
          },
          {
            icon: <Globe size={20} />,
            label: 'Referrer Channels',
            value: data.byReferer.length,
            color: '#059669',
            bg: 'rgba(5, 150, 105, 0.08)',
          },
          {
            icon: <Layers size={20} />,
            label: isAccountMode ? 'Active Links' : 'Created Date',
            value: isAccountMode
              ? (data.summary.activeUrls || 0)
              : new Date(data.url.created_at).toLocaleDateString(),
            color: '#d97706',
            bg: 'rgba(217, 119, 6, 0.08)',
          },
        ].map(card => (
          <div className="stat-card" key={card.label}>
            <div className="stat-icon" style={{ background: card.bg, color: card.color }}>{card.icon}</div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Clicks & Unique Visitors Over Time Chart */}
      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-title">
          <TrendingUp size={16} /> Daily Traffic & Unique Visitors
        </div>
        {data.dailyClicks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            No recorded click events in the last {days} days.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.dailyClicks.map(d => ({
              date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              clicks: parseInt(d.clicks || 0, 10),
              unique: parseInt(d.unique_visitors || d.unique || 0, 10),
            }))}>
              <defs>
                <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.85rem' }} />
              <Area type="monotone" dataKey="clicks" name="Total Clicks" stroke="#2563eb" strokeWidth={2} fill="url(#clickGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Multi-Column Breakdowns Grid */}
      <div className="analytics-grid">
        {/* Top Referrers */}
        <div className="chart-card">
          <div className="chart-title"><Globe size={16} /> Top Referrers</div>
          {data.byReferer.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No referrer data recorded
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.byReferer.slice(0, 8).map((r, i) => {
                const max = parseInt(data.byReferer[0].clicks, 10) || 1;
                const clicks = parseInt(r.clicks, 10);
                const pct = Math.round((clicks / max) * 100);
                return (
                  <div key={r.referer || i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-all' }}>
                        {r.referer || 'Direct / Internal'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{clicks.toLocaleString()}</span>
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

        {/* Device & Browser Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Devices Pie */}
          <div className="chart-card">
            <div className="chart-title"><Monitor size={16} /> Device Types</div>
            {deviceData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={deviceData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={4}>
                      {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {deviceData.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.pct}% ({d.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Operating Systems or Browsers */}
          <div className="chart-card">
            <div className="chart-title"><Laptop size={16} /> Operating Systems & Browsers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.byOs || []).length > 0 ? (
                data.byOs.slice(0, 5).map((osItem, i) => {
                  const max = parseInt(data.byOs[0].clicks, 10) || 1;
                  const clicks = parseInt(osItem.clicks, 10);
                  const pct = Math.round((clicks / max) * 100);
                  return (
                    <div key={osItem.os || i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{osItem.os || 'Unknown OS'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{clicks}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })
              ) : data.byBrowser.length > 0 ? (
                data.byBrowser.slice(0, 5).map((b, i) => {
                  const max = parseInt(data.byBrowser[0].clicks, 10) || 1;
                  const clicks = parseInt(b.clicks, 10);
                  const pct = Math.round((clicks / max) * 100);
                  return (
                    <div key={b.browser || i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{b.browser || 'Unknown'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{clicks}</span>
                      </div>
                      <div className="progress-bar" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No system breakdown data yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Geolocation Notice Card (Honest Reporting) */}
      <div className="card" style={{ marginTop: 24, padding: '18px 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Globe size={18} color="var(--text-muted)" />
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <strong>Geolocation Audit:</strong> Exact visitor geographic coordinates are reported as unavailable unless an authenticated, verified enterprise GeoIP provider is integrated. Axly does not generate fabricated geo coordinates.
          </div>
        </div>
      </div>

      {/* QR Modal if requested */}
      {showQr && !isAccountMode && <QRModal urlId={id} onClose={() => setShowQr(false)} />}
    </div>
  );
}
