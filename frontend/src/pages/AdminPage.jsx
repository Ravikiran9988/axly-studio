import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, Users, Link2, MousePointerClick, Activity, Search, 
  Trash2, ArrowUpRight, CheckCircle2, XCircle, ArrowLeft, RefreshCw,
  Sliders, ShieldCheck, KeyRound
} from 'lucide-react';
import { api, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'urls'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [urlSearch, setUrlSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [statsRes, usersRes, urlsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/urls'),
      ]);

      setStats(statsRes.data.data);
      setUsers(usersRes.data.data);
      setUrls(urlsRes.data.data);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Access denied. Administrator privileges required.');
        navigate('/app/dashboard');
      } else {
        toast.error('Failed to load administrator records.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleRole = async (targetUser) => {
    if (targetUser.id === user.id) {
      toast.error('You cannot change your own administrator role.');
      return;
    }

    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const confirmMsg = `Are you sure you want to change ${targetUser.name}'s role to ${nextRole.toUpperCase()}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.patch(`/admin/users/${targetUser.id}/role`, { role: nextRole });
      toast.success(res.data.message || `Role updated to ${nextRole}`);
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: nextRole } : u));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    }
  };

  const handleToggleStatus = async (targetUser) => {
    if (targetUser.id === user.id) {
      toast.error('You cannot disable your own administrator account.');
      return;
    }

    const nextStatus = !targetUser.is_active;
    const confirmMsg = `Are you sure you want to ${nextStatus ? 'ACTIVATE' : 'SUSPEND'} ${targetUser.name}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.patch(`/admin/users/${targetUser.id}/status`, { isActive: nextStatus });
      toast.success(res.data.message || 'Status updated');
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_active: nextStatus } : u));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  const handleDeleteUrl = async (urlId, shortCode) => {
    if (!window.confirm(`Delete short URL /${shortCode} permanently across the system?`)) return;

    try {
      const res = await api.delete(`/admin/urls/${urlId}`);
      toast.success(res.data.message || 'Short URL deleted.');
      setUrls(prev => prev.filter(u => u.id !== urlId));
      if (stats) {
        setStats(prev => ({ ...prev, totalUrls: prev.totalUrls - 1 }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete URL.');
    }
  };

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredUrls = urls.filter(u => {
    const q = urlSearch.toLowerCase();
    return (
      u.short_code.toLowerCase().includes(q) ||
      u.original_url.toLowerCase().includes(q) ||
      (u.owner_email && u.owner_email.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px', borderWidth: 3 }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading Administrator Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 60 }}>
      {/* Admin Top Header */}
      <div className="admin-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="badge badge-admin">
              <ShieldAlert size={12} style={{ marginRight: 4 }} /> System Administrator
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Axly Studio Control Center</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800 }}>
            Administrator Operations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: 4 }}>
            Monitor system-wide link activity, enforce policy, and manage tenant roles.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            className="btn btn-outline" 
            onClick={loadData} 
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <Link to="/app/dashboard" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={15} />
            <span>Return to Studio App</span>
          </Link>
        </div>
      </div>

      {/* High-Level Metric Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Users size={26} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">{stats?.totalUsers ?? 0}</span>
            <span className="admin-stat-lbl">Total Registered Users</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <Link2 size={26} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">{stats?.totalUrls ?? 0}</span>
            <span className="admin-stat-lbl">Global URLs Created</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <MousePointerClick size={26} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">{(stats?.totalClicks ?? 0).toLocaleString()}</span>
            <span className="admin-stat-lbl">Total Platform Clicks</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
            <ShieldCheck size={26} />
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">
              {stats?.roles?.find(r => r.role === 'admin')?.count ?? 1}
            </span>
            <span className="admin-stat-lbl">System Administrators</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={16} /> Overview & Health
        </button>
        <button 
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} /> User Management ({users.length})
        </button>
        <button 
          className={`admin-tab ${activeTab === 'urls' ? 'active' : ''}`}
          onClick={() => setActiveTab('urls')}
        >
          <Link2 size={16} /> Global Links ({urls.length})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
          {/* Top Links Card */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              🔥 Top Performing Links Platform-Wide
            </h3>
            {stats?.topUrls?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.topUrls.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>/{item.short_code}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Owner: {item.owner_email}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: '0.95rem' }}>
                        {Number(item.click_count).toLocaleString()} clicks
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {Number(item.unique_clicks).toLocaleString()} unique
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No click activity recorded yet.</p>
            )}
          </div>

          {/* Infrastructure Health Card */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              ⚡ Operational Status & Infrastructure
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Database Engine</span>
                <strong>Lakebase PostgreSQL (Neon)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Connection Mode</span>
                <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: 'none' }}>
                  TLS 1.3 Pooled SSL Active
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Deduplication Protocol</span>
                <strong>HMAC-SHA256 Salted Visitor Hash</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Access Governance</span>
                <strong>Role-Based Access Control (RBAC)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Users Management */}
      {activeTab === 'users' && (
        <div>
          <div className="admin-toolbar">
            <div className="admin-search-wrap">
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search users by name or email..."
                className="admin-search-input"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {filteredUsers.length} of {users.length} accounts
            </span>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User Profile</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Links</th>
                  <th>Total Clicks</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="user-avatar" style={{ width: 34, height: 34, fontSize: '0.8rem' }}>
                            {u.name?.slice(0, 2).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{u.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <button
                          className={`role-badge-btn ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}`}
                          onClick={() => handleToggleRole(u)}
                          title="Click to toggle Admin / User role"
                        >
                          {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                        </button>
                      </td>
                      <td>
                        <button
                          className={`status-badge-btn`}
                          style={{
                            background: u.is_active ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: u.is_active ? 'var(--success)' : 'var(--danger)',
                          }}
                          onClick={() => handleToggleStatus(u)}
                          title="Click to toggle Active / Suspended status"
                        >
                          {u.is_active ? 'Active' : 'Suspended'}
                        </button>
                      </td>
                      <td><strong>{u.links_count}</strong></td>
                      <td><strong>{u.total_clicks.toLocaleString()}</strong></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                            onClick={() => handleToggleRole(u)}
                          >
                            Toggle Role
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No matching user accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Global URLs Moderation */}
      {activeTab === 'urls' && (
        <div>
          <div className="admin-toolbar">
            <div className="admin-search-wrap">
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by code, destination URL, or owner..."
                className="admin-search-input"
                value={urlSearch}
                onChange={(e) => setUrlSearch(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {filteredUrls.length} of {urls.length} URLs
            </span>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Short Code</th>
                  <th>Original Target Destination</th>
                  <th>Account Owner</th>
                  <th>Clicks / Unique</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Moderate</th>
                </tr>
              </thead>
              <tbody>
                {filteredUrls.length > 0 ? (
                  filteredUrls.map(link => (
                    <tr key={link.id}>
                      <td>
                        <a 
                          href={`/${link.short_code}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brand-primary)' }}
                        >
                          /{link.short_code}
                        </a>
                      </td>
                      <td>
                        <span style={{ maxWidth: 280, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={link.original_url}>
                          {link.original_url}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {link.owner_email || 'Anonymous Guest'}
                        </span>
                      </td>
                      <td>
                        <strong>{link.click_count}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                          ({link.unique_clicks} unique)
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(link.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ color: 'var(--danger)', padding: '6px 10px' }}
                          onClick={() => handleDeleteUrl(link.id, link.short_code)}
                          title="Delete short link across system"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No matching short URLs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
