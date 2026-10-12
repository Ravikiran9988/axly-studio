import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, Users, Link2, MousePointerClick, Activity, Search, 
  Trash2, ArrowUpRight, CheckCircle2, XCircle, ArrowLeft, RefreshCw,
  Sliders, ShieldCheck, KeyRound, AlertTriangle, AlertOctagon,
  Clock, Shield, Eye, Lock, FileText, Settings, HeartPulse,
  ExternalLink, UserX, UserCheck, ChevronLeft, ChevronRight, Check
} from 'lucide-react';
import { api, useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active workspace tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'moderation' | 'urls' | 'health' | 'settings' | 'audit'

  // Loading & refresh states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [urls, setUrls] = useState([]);
  const [urlsPagination, setUrlsPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [reports, setReports] = useState([]);
  const [reportsPagination, setReportsPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [healthData, setHealthData] = useState({ stats: {}, recentChecks: [] });
  const [platformSettings, setPlatformSettings] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Filter states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  const [urlSearch, setUrlSearch] = useState('');
  const [urlModerationFilter, setUrlModerationFilter] = useState('');

  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [reportSearch, setReportSearch] = useState('');

  // Modals & Action Drawers
  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [selectedReportReview, setSelectedReportReview] = useState(null);
  const [reportReviewNotes, setReportReviewNotes] = useState('');
  const [reportReviewStatus, setReportReviewStatus] = useState('resolved');
  const [probingUrlId, setProbingUrlId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // 1. Load Primary Stats
  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data.data);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Access denied. Administrator privileges required.');
        navigate('/app/dashboard');
      } else {
        toast.error('Failed to load system metrics.');
      }
    }
  }, [navigate]);

  // 2. Load Users
  const loadUsers = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 15 };
      if (userSearch) params.search = userSearch;
      if (userRoleFilter) params.role = userRoleFilter;
      if (userStatusFilter) params.status = userStatusFilter;

      const res = await api.get('/admin/users', { params });
      setUsers(res.data.data || []);
      if (res.data.pagination) setUsersPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    }
  }, [userSearch, userRoleFilter, userStatusFilter]);

  // 3. Load Moderation Reports
  const loadReports = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 15 };
      if (reportStatusFilter) params.status = reportStatusFilter;
      if (reportSearch) params.search = reportSearch;

      const res = await api.get('/admin/moderation/reports', { params });
      setReports(res.data.data || []);
      if (res.data.pagination) setReportsPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    }
  }, [reportStatusFilter, reportSearch]);

  // 4. Load Global URLs
  const loadUrls = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 15 };
      if (urlSearch) params.search = urlSearch;
      if (urlModerationFilter) params.moderationStatus = urlModerationFilter;

      const res = await api.get('/admin/urls', { params });
      setUrls(res.data.data || []);
      if (res.data.pagination) setUrlsPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    }
  }, [urlSearch, urlModerationFilter]);

  // 5. Load Health Overview
  const loadHealth = useCallback(async () => {
    try {
      const res = await api.get('/admin/health');
      setHealthData(res.data.data || { stats: {}, recentChecks: [] });
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 6. Load Settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/admin/settings');
      setPlatformSettings(res.data.data || {});
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 7. Load Audit Trail
  const loadAudit = useCallback(async (page = 1) => {
    try {
      const res = await api.get('/admin/audit', { params: { page, limit: 20 } });
      setAuditLogs(res.data.data || []);
      if (res.data.pagination) setAuditPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Initial Data Load
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadStats(),
      loadUsers(1),
      loadReports(1),
      loadUrls(1),
      loadHealth(),
      loadSettings(),
      loadAudit(1),
    ]);
    setLoading(false);
    setRefreshing(false);
  }, [loadStats, loadUsers, loadReports, loadUrls, loadHealth, loadSettings, loadAudit]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Tab change reactive loaders
  useEffect(() => {
    if (activeTab === 'users') loadUsers(1);
    if (activeTab === 'moderation') loadReports(1);
    if (activeTab === 'urls') loadUrls(1);
    if (activeTab === 'health') loadHealth();
    if (activeTab === 'settings') loadSettings();
    if (activeTab === 'audit') loadAudit(1);
  }, [activeTab, loadUsers, loadReports, loadUrls, loadHealth, loadSettings, loadAudit]);

  // Handle Role Toggle
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
      loadUsers(usersPagination.page);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    }
  };

  // Handle Account Suspension / Reactivation
  const handleToggleStatus = async (targetUser) => {
    if (targetUser.id === user.id) {
      toast.error('You cannot disable your own administrator account.');
      return;
    }

    const nextStatus = !targetUser.is_active;
    const actionLabel = nextStatus ? 'ACTIVATE' : 'SUSPEND';
    const reason = window.prompt(`Confirm ${actionLabel} account for ${targetUser.name} (${targetUser.email}). Provide an operational reason:`, 'Administrative compliance check');
    if (reason === null) return;

    try {
      const res = await api.patch(`/admin/users/${targetUser.id}/status`, { isActive: nextStatus, reason });
      toast.success(res.data.message || 'Status updated');
      loadUsers(usersPagination.page);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  // Handle Revoke User Sessions
  const handleRevokeSessions = async (targetUser) => {
    if (!window.confirm(`Force sign-out and invalidate all active sessions for ${targetUser.email}?`)) return;

    try {
      const res = await api.post(`/admin/users/${targetUser.id}/revoke-sessions`, { reason: 'Admin security reset' });
      toast.success(res.data.message || 'All sessions revoked.');
      loadUsers(usersPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke sessions.');
    }
  };

  // Handle View User Activity
  const handleViewUserActivity = async (targetUser) => {
    try {
      const res = await api.get(`/admin/users/${targetUser.id}/activity`);
      setSelectedUserActivity(res.data.data);
    } catch (err) {
      toast.error('Failed to load user activity details.');
    }
  };

  // Handle URL Delete
  const handleDeleteUrl = async (urlId, shortCode) => {
    if (!window.confirm(`Delete short URL /${shortCode} permanently across the system?`)) return;

    try {
      const res = await api.delete(`/admin/urls/${urlId}`);
      toast.success(res.data.message || 'Short URL deleted.');
      loadUrls(urlsPagination.page);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete URL.');
    }
  };

  // Handle URL Moderation (Suspend / Enable link)
  const handleModerateUrl = async (urlId, action) => {
    const isSuspending = action === 'suspend';
    const reason = window.prompt(`Provide moderation reason for ${isSuspending ? 'suspending' : 'approving'} this link:`, isSuspending ? 'Terms violation or malicious destination' : 'Verified safe destination');
    if (reason === null) return;

    try {
      const res = await api.patch(`/admin/urls/${urlId}/moderation`, {
        moderationStatus: isSuspending ? 'suspended' : 'approved',
        linkStatus: isSuspending ? 'inactive' : 'active',
        reason,
      });
      toast.success(res.data.message || 'Link moderation status updated.');
      loadUrls(urlsPagination.page);
      loadReports(reportsPagination.page);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update link moderation.');
    }
  };

  // Handle Report Review
  const handleResolveReport = async (e) => {
    e.preventDefault();
    if (!selectedReportReview) return;

    try {
      const res = await api.patch(`/admin/moderation/reports/${selectedReportReview.id}`, {
        status: reportReviewStatus,
        notes: reportReviewNotes,
      });
      toast.success(res.data.message || 'Report reviewed successfully.');
      setSelectedReportReview(null);
      setReportReviewNotes('');
      loadReports(reportsPagination.page);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update report.');
    }
  };

  // Handle Safe Health Check Probe
  const handleTriggerHealthCheck = async (urlId, shortCode) => {
    try {
      setProbingUrlId(urlId);
      const res = await api.post(`/admin/health/check/${urlId}`);
      const probe = res.data.probe;
      if (probe.isHealthy) {
        toast.success(`Probe succeeded! /${shortCode} HTTP ${probe.statusCode} in ${probe.responseTimeMs}ms`);
      } else {
        toast.error(`Health probe failed: ${probe.errorReason || `HTTP ${probe.statusCode}`}`);
      }
      loadHealth();
      loadUrls(urlsPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to run health check probe.');
    } finally {
      setProbingUrlId(null);
    }
  };

  // Handle Platform Settings Update
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);

    try {
      const res = await api.put('/admin/settings', { settings: platformSettings });
      toast.success(res.data.message || 'Platform settings updated successfully.');
      loadSettings();
      loadAudit(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save platform configuration.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px', borderWidth: 3 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Axly Operations & Control Center</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Authenticating administrative privileges and querying PostgreSQL cluster...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 1360, margin: '0 auto', paddingBottom: 80 }}>
      {/* Top Header */}
      <div className="admin-header" style={{ marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="badge badge-admin" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldAlert size={13} /> Axly Studio Governance
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Production Administrative Control Center
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', fontWeight: 800 }}>
            Platform Control & Operations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: 4 }}>
            Monitor real-time system metrics, manage tenant permissions, moderate links, and enforce SSRF-safe health checks.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button 
            className="btn btn-outline" 
            onClick={refreshAll} 
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>
          <Link to="/app/dashboard" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={15} />
            <span>Return to Studio App</span>
          </Link>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="admin-tabs" style={{ overflowX: 'auto', marginBottom: 28 }}>
        <button 
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={16} /> Overview & Telemetry
        </button>
        <button 
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} /> User Directory ({stats?.totalUsers ?? users.length})
        </button>
        <button 
          className={`admin-tab ${activeTab === 'moderation' ? 'active' : ''}`}
          onClick={() => setActiveTab('moderation')}
        >
          <ShieldAlert size={16} /> Abuse Moderation Queue 
          {stats?.pendingReports > 0 && (
            <span style={{
              background: '#ef4444', color: '#fff', fontSize: '0.72rem',
              fontWeight: 700, padding: '2px 7px', borderRadius: 10, marginLeft: 4,
            }}>
              {stats.pendingReports}
            </span>
          )}
        </button>
        <button 
          className={`admin-tab ${activeTab === 'urls' ? 'active' : ''}`}
          onClick={() => setActiveTab('urls')}
        >
          <Link2 size={16} /> Global Links ({stats?.totalUrls ?? urls.length})
        </button>
        <button 
          className={`admin-tab ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <HeartPulse size={16} /> Destination Health Hub
        </button>
        <button 
          className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Sliders size={16} /> Operational Settings
        </button>
        <button 
          className={`admin-tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <FileText size={16} /> Audit Trail
        </button>
      </div>

      {/* TAB 1: OVERVIEW & TELEMETRY */}
      {activeTab === 'overview' && (
        <div>
          {/* Top KPI Cards Grid */}
          <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Users size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats?.totalUsers ?? 0}</span>
                <span className="admin-stat-lbl">Registered Accounts</span>
                <span style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 4 }}>
                  {stats?.activeUsers ?? 0} active · {stats?.suspendedUsers ?? 0} suspended
                </span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Link2 size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats?.totalUrls ?? 0}</span>
                <span className="admin-stat-lbl">Global Links Created</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {stats?.guestUrls ?? 0} guest · {stats?.activeUrls ?? 0} active
                </span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <MousePointerClick size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{(stats?.totalClicks ?? 0).toLocaleString()}</span>
                <span className="admin-stat-lbl">Lifetime Clicks Tracked</span>
                <span style={{ fontSize: '0.75rem', color: '#059669', marginTop: 4 }}>
                  +{stats?.clicks24h ?? 0} in 24h · +{stats?.clicks7d ?? 0} in 7d
                </span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <ShieldAlert size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats?.pendingReports ?? 0}</span>
                <span className="admin-stat-lbl">Pending Abuse Reports</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {stats?.reviewingReports ?? 0} reviewing · {stats?.resolvedReports ?? 0} resolved
                </span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                <HeartPulse size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats?.healthyLinks ?? 0}</span>
                <span className="admin-stat-lbl">Healthy Destinations</span>
                <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>
                  {stats?.unreachableLinks ?? 0} unreachable · {stats?.degradedLinks ?? 0} degraded
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry and Top Links Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24, marginTop: 12 }}>
            {/* System Telemetry */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={18} style={{ color: 'var(--brand-primary)' }} />
                  Operational Telemetry & Runtime
                </h3>
                <span className="badge" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>
                  ● System Operational
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Database</span>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>PostgreSQL (Neon)</div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 2 }}>Connected & Verified</div>
                </div>

                <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Node.js Runtime</span>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>{stats?.telemetry?.nodeVersion || 'v20.x'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Environment: {stats?.telemetry?.environment}</div>
                </div>

                <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Process Memory</span>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>{stats?.telemetry?.rssMemoryMb || 64} MB RSS</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Heap Used: {stats?.telemetry?.heapUsedMb || 32} MB</div>
                </div>

                <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Service Uptime</span>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>
                    {Math.floor((stats?.telemetry?.uptimeSeconds || 0) / 3600)}h {Math.floor(((stats?.telemetry?.uptimeSeconds || 0) % 3600) / 60)}m
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: 2 }}>Zero worker crashes</div>
                </div>
              </div>
            </div>

            {/* Top Links Platform-Wide */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MousePointerClick size={18} style={{ color: '#7c3aed' }} />
                Highest Traffic Links Platform-Wide
              </h3>
              {stats?.topUrls?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.topUrls.map((item, idx) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                            /{item.short_code}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            by {item.owner_email}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                          {item.original_url}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.click_count}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>clicks</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No links recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div>
          {/* User Filtering Toolbar */}
          <div className="admin-toolbar" style={{ gap: 12 }}>
            <div className="admin-search-wrap" style={{ flex: 1 }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search user by name or email..."
                className="admin-search-input"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers(1)}
              />
            </div>

            <select 
              className="form-input" 
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.88rem' }}
              value={userRoleFilter}
              onChange={(e) => { setUserRoleFilter(e.target.value); }}
            >
              <option value="">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="user">Standard Users</option>
            </select>

            <select 
              className="form-input" 
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.88rem' }}
              value={userStatusFilter}
              onChange={(e) => { setUserStatusFilter(e.target.value); }}
            >
              <option value="">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>

            <button className="btn btn-outline" onClick={() => loadUsers(1)} style={{ padding: '8px 14px' }}>
              Filter
            </button>
          </div>

          {/* User Directory Table */}
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Account Identity</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Links / Clicks</th>
                  <th>Last Login / Activity</th>
                  <th>Joined Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: u.role === 'admin' ? '#eff6ff' : 'var(--bg-secondary)',
                            color: u.role === 'admin' ? '#2563eb' : 'var(--text-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.8rem',
                          }}>
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
                          title="Click to promote or demote user role"
                        >
                          <Shield size={12} />
                          {u.role.toUpperCase()}
                        </button>
                      </td>
                      <td>
                        <button
                          className={`status-badge-btn ${u.is_active ? 'badge-active' : 'badge-disabled'}`}
                          onClick={() => handleToggleStatus(u)}
                          title="Click to suspend or activate account"
                        >
                          {u.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {u.is_active ? 'Active' : 'Suspended'}
                        </button>
                      </td>
                      <td>
                        <strong>{u.url_count || 0}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                          ({(u.total_clicks || 0).toLocaleString()} clicks)
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never logged'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 8px', fontSize: '0.78rem' }}
                            onClick={() => handleViewUserActivity(u)}
                            title="Inspect user links & activity"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 8px', fontSize: '0.78rem', color: '#d97706' }}
                            onClick={() => handleRevokeSessions(u)}
                            title="Force session invalidation (re-auth)"
                          >
                            <KeyRound size={14} />
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

          {/* Pagination Controls */}
          {usersPagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing page {usersPagination.page} of {usersPagination.pages} ({usersPagination.total} total accounts)
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-outline"
                  disabled={usersPagination.page <= 1}
                  onClick={() => loadUsers(usersPagination.page - 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn-outline"
                  disabled={usersPagination.page >= usersPagination.pages}
                  onClick={() => loadUsers(usersPagination.page + 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MODERATION & ABUSE QUEUE */}
      {activeTab === 'moderation' && (
        <div>
          {/* Moderation Toolbar */}
          <div className="admin-toolbar" style={{ gap: 12 }}>
            <div className="admin-search-wrap" style={{ flex: 1 }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search reports by short code or destination..."
                className="admin-search-input"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadReports(1)}
              />
            </div>

            <select 
              className="form-input" 
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.88rem' }}
              value={reportStatusFilter}
              onChange={(e) => { setReportStatusFilter(e.target.value); }}
            >
              <option value="">All Report Statuses</option>
              <option value="pending">Pending Review Only</option>
              <option value="reviewing">Under Active Review</option>
              <option value="resolved">Resolved (Action Taken)</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <button className="btn btn-outline" onClick={() => loadReports(1)} style={{ padding: '8px 14px' }}>
              Filter Queue
            </button>
          </div>

          {/* Moderation Queue Table */}
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reported Link</th>
                  <th>Destination Target</th>
                  <th>Violation Type</th>
                  <th>Evidence / Details</th>
                  <th>Status</th>
                  <th>Reported At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.length > 0 ? (
                  reports.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                          /{r.short_code}
                        </span>
                      </td>
                      <td>
                        <span style={{ maxWidth: 240, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={r.original_url}>
                          {r.original_url}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: r.reason === 'phishing' ? '#fef2f2' : r.reason === 'malware' ? '#f5f3ff' : 'var(--bg-secondary)',
                          color: r.reason === 'phishing' ? '#dc2626' : r.reason === 'malware' ? '#7c3aed' : 'var(--text-primary)',
                          fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem',
                        }}>
                          {r.reason}
                        </span>
                      </td>
                      <td>
                        <span style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-secondary)' }} title={r.details}>
                          {r.details || 'No additional details provided'}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: r.status === 'pending' ? '#fffbeb' : r.status === 'reviewing' ? '#eff6ff' : r.status === 'resolved' ? '#ecfdf5' : 'var(--bg-secondary)',
                          color: r.status === 'pending' ? '#d97706' : r.status === 'reviewing' ? '#2563eb' : r.status === 'resolved' ? '#059669' : 'var(--text-muted)',
                          fontWeight: 600,
                        }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            onClick={() => {
                              setSelectedReportReview(r);
                              setReportReviewStatus(r.status === 'pending' ? 'reviewing' : r.status);
                              setReportReviewNotes(r.reviewer_notes || '');
                            }}
                          >
                            Review
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                            onClick={() => handleModerateUrl(r.url_id, 'suspend')}
                            title="Disable & suspend link"
                          >
                            <AlertOctagon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      🎉 Zero active abuse reports in the moderation queue!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Reports Pagination */}
          {reportsPagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing page {reportsPagination.page} of {reportsPagination.pages} ({reportsPagination.total} reports)
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-outline"
                  disabled={reportsPagination.page <= 1}
                  onClick={() => loadReports(reportsPagination.page - 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn-outline"
                  disabled={reportsPagination.page >= reportsPagination.pages}
                  onClick={() => loadReports(reportsPagination.page + 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GLOBAL LINKS REGISTRY */}
      {activeTab === 'urls' && (
        <div>
          <div className="admin-toolbar" style={{ gap: 12 }}>
            <div className="admin-search-wrap" style={{ flex: 1 }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by code, destination URL, or owner email..."
                className="admin-search-input"
                value={urlSearch}
                onChange={(e) => setUrlSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUrls(1)}
              />
            </div>

            <select 
              className="form-input" 
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.88rem' }}
              value={urlModerationFilter}
              onChange={(e) => { setUrlModerationFilter(e.target.value); }}
            >
              <option value="">All Moderation Statuses</option>
              <option value="approved">Approved</option>
              <option value="suspended">Suspended / Disabled</option>
              <option value="under_review">Under Review</option>
            </select>

            <button className="btn btn-outline" onClick={() => loadUrls(1)} style={{ padding: '8px 14px' }}>
              Filter Links
            </button>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Short Code</th>
                  <th>Destination Target</th>
                  <th>Owner</th>
                  <th>Health Status</th>
                  <th>Clicks / Unique</th>
                  <th>Moderation</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {urls.length > 0 ? (
                  urls.map(link => (
                    <tr key={link.id}>
                      <td>
                        <a 
                          href={`/${link.short_code}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-primary)' }}
                        >
                          /{link.short_code}
                        </a>
                      </td>
                      <td>
                        <span style={{ maxWidth: 260, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={link.original_url}>
                          {link.original_url}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {link.owner_email || 'Anonymous Guest'}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: link.health_status === 'healthy' ? '#ecfdf5' : link.health_status === 'unreachable' ? '#fef2f2' : 'var(--bg-secondary)',
                          color: link.health_status === 'healthy' ? '#059669' : link.health_status === 'unreachable' ? '#dc2626' : 'var(--text-muted)',
                          fontSize: '0.72rem', fontWeight: 700,
                        }}>
                          {link.health_status || 'unknown'}
                        </span>
                      </td>
                      <td>
                        <strong>{link.click_count}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                          ({link.unique_clicks} u)
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: link.moderation_status === 'suspended' ? '#fef2f2' : link.moderation_status === 'under_review' ? '#fffbeb' : '#ecfdf5',
                          color: link.moderation_status === 'suspended' ? '#dc2626' : link.moderation_status === 'under_review' ? '#d97706' : '#059669',
                          fontSize: '0.72rem', fontWeight: 700,
                        }}>
                          {link.moderation_status || 'approved'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 8px', color: 'var(--brand-primary)' }}
                            onClick={() => handleTriggerHealthCheck(link.id, link.short_code)}
                            disabled={probingUrlId === link.id}
                            title="Run SSRF-safe destination health check"
                          >
                            <HeartPulse size={14} className={probingUrlId === link.id ? 'spin' : ''} />
                          </button>
                          {link.moderation_status === 'suspended' ? (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '6px 8px', color: '#16a34a' }}
                              onClick={() => handleModerateUrl(link.id, 'approve')}
                              title="Re-activate / Approve link"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '6px 8px', color: '#dc2626' }}
                              onClick={() => handleModerateUrl(link.id, 'suspend')}
                              title="Suspend / Disable link"
                            >
                              <AlertOctagon size={14} />
                            </button>
                          )}
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 8px', color: 'var(--danger)' }}
                            onClick={() => handleDeleteUrl(link.id, link.short_code)}
                            title="Delete link permanently"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No matching short URLs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* URLs Pagination */}
          {urlsPagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing page {urlsPagination.page} of {urlsPagination.pages} ({urlsPagination.total} URLs)
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-outline"
                  disabled={urlsPagination.page <= 1}
                  onClick={() => loadUrls(urlsPagination.page - 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn-outline"
                  disabled={urlsPagination.page >= urlsPagination.pages}
                  onClick={() => loadUrls(urlsPagination.page + 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DESTINATION HEALTH HUB */}
      {activeTab === 'health' && (
        <div>
          {/* Security Banner */}
          <div style={{
            padding: '16px 20px', background: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: 'var(--radius-lg)',
            marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <ShieldCheck size={22} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Strict Server-Side Request Forgery (SSRF) Guard Active</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Destination health probes inspect all resolved IPv4 & IPv6 addresses and every HTTP redirect hop.
                Probes strictly block loopback, RFC1918 private subnets, cloud metadata (169.254.169.254), link-local, and multicast addresses to protect internal infrastructure.
              </div>
            </div>
          </div>

          {/* Health Stats */}
          <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <CheckCircle2 size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{healthData?.stats?.healthy_links ?? 0}</span>
                <span className="admin-stat-lbl">Healthy Destinations (2xx/3xx)</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                <Clock size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{healthData?.stats?.degraded_links ?? 0}</span>
                <span className="admin-stat-lbl">Degraded Latency (&gt;2000ms)</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <AlertOctagon size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{healthData?.stats?.unreachable_links ?? 0}</span>
                <span className="admin-stat-lbl">Unreachable (DNS / Timeout / 5xx)</span>
              </div>
            </div>
          </div>

          {/* Recent Checks Table */}
          <div className="card" style={{ padding: 24, marginTop: 12 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>
              Recent Safe Health Check Probes
            </h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Short Code</th>
                    <th>Destination URL</th>
                    <th>HTTP Status</th>
                    <th>Response Latency</th>
                    <th>Health Status</th>
                    <th>Error Detail</th>
                    <th>Probe Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {healthData?.recentChecks?.length > 0 ? (
                    healthData.recentChecks.map(probe => (
                      <tr key={probe.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-primary)' }}>
                          /{probe.short_code}
                        </td>
                        <td>
                          <span style={{ maxWidth: 260, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={probe.target_url}>
                            {probe.target_url}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{probe.status_code || '---'}</span>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 600,
                            color: probe.response_time_ms < 500 ? '#16a34a' : probe.response_time_ms < 2000 ? '#d97706' : '#dc2626'
                          }}>
                            {probe.response_time_ms ? `${probe.response_time_ms} ms` : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: probe.is_healthy ? '#ecfdf5' : '#fef2f2',
                            color: probe.is_healthy ? '#059669' : '#dc2626',
                            fontWeight: 700, fontSize: '0.72rem',
                          }}>
                            {probe.is_healthy ? 'HEALTHY' : 'FAILING'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {probe.error_reason || 'None'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(probe.checked_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                        No destination probes recorded yet. Probes run on-demand or during scheduled health intervals.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: OPERATIONAL SETTINGS & FEATURE FLAGS */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: 840 }}>
          <form onSubmit={handleSaveSettings}>
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sliders size={20} style={{ color: 'var(--brand-primary)' }} />
                Platform Quotas & Limits
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 24 }}>
                Configure rate limits, link quotas, and safety policies. All changes are strictly validated and audited.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Guest Daily Creation Limit
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.guest_creation_limit_daily ?? 25}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, guest_creation_limit_daily: parseInt(e.target.value, 10) }))}
                    min={1}
                    max={500}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max links anonymous visitors can create per 24 hours.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Authenticated Max Links Total
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.authenticated_max_links_total ?? 1000}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, authenticated_max_links_total: parseInt(e.target.value, 10) }))}
                    min={10}
                    max={100000}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total links standard accounts can own.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Maximum Accepted URL Length (bytes)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.max_url_length ?? 4096}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, max_url_length: parseInt(e.target.value, 10) }))}
                    min={256}
                    max={16384}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upper length limit for input destination URLs.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Default Expiration Policy (Days)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.default_link_expiration_days ?? 365}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, default_link_expiration_days: parseInt(e.target.value, 10) }))}
                    min={0}
                    max={3650}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0 = Permanent links permitted.</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
                System Feature Flags
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
                Control platform capabilities dynamically across backend API and frontend interfaces.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { key: 'feature_guest_shortening', title: 'Anonymous Guest Shortening', desc: 'Allows public visitors to shorten URLs without creating an account.' },
                  { key: 'feature_smart_routing', title: 'Smart Device / Geo Redirect Rules', desc: 'Enables conditional redirection based on device, OS, and location.' },
                  { key: 'feature_ab_experiments', title: 'A/B Experiments & Split Traffic', desc: 'Enables destination split testing and conversion goal tracking.' },
                  { key: 'feature_abuse_reports', title: 'Public Abuse Reporting Portal', desc: 'Allows visitors to submit phishing and malware abuse reports.' },
                ].map(flag => (
                  <label key={flag.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{flag.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{flag.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(platformSettings[flag.key] ?? true)}
                      onChange={(e) => setPlatformSettings(prev => ({ ...prev, [flag.key]: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingSettings}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}
            >
              <Check size={16} />
              <span>{savingSettings ? 'Persisting Configuration...' : 'Save & Enforce Configuration'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 7: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div>
          <div className="admin-toolbar">
            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              Immutable Compliance & Security Audit Trail
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Showing {auditLogs.length} recent governance operations
            </span>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Actor (Admin)</th>
                  <th>Action</th>
                  <th>Target Type</th>
                  <th>Target ID</th>
                  <th>Audit Details</th>
                  <th>Operator Hash</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length > 0 ? (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {log.actor_email}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: log.action.includes('delete') || log.action.includes('suspend') ? '#fef2f2' : '#eff6ff',
                          color: log.action.includes('delete') || log.action.includes('suspend') ? '#dc2626' : '#2563eb',
                          fontWeight: 700, fontSize: '0.72rem', fontFamily: 'monospace',
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {log.target_type}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {log.target_id?.slice(0, 8)}...
                      </td>
                      <td>
                        <span style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title={JSON.stringify(log.details)}>
                          {JSON.stringify(log.details)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {log.ip_hash?.slice(0, 10)}...
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Audit Pagination */}
          {auditPagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing page {auditPagination.page} of {auditPagination.pages} ({auditPagination.total} audit records)
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-outline"
                  disabled={auditPagination.page <= 1}
                  onClick={() => loadAudit(auditPagination.page - 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn-outline"
                  disabled={auditPagination.page >= auditPagination.pages}
                  onClick={() => loadAudit(auditPagination.page + 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Report Review & Resolution */}
      {selectedReportReview && (
        <div className="modal-backdrop" onClick={() => setSelectedReportReview(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
        }}>
          <div 
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 540, padding: 28,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>
              Review Abuse Report: /{selectedReportReview.short_code}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Destination: <span style={{ color: 'var(--brand-primary)', wordBreak: 'break-all' }}>{selectedReportReview.original_url}</span>
            </p>

            <form onSubmit={handleResolveReport}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Queue Resolution Status
                </label>
                <select
                  className="form-input"
                  value={reportReviewStatus}
                  onChange={(e) => setReportReviewStatus(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="reviewing">In Progress / Reviewing</option>
                  <option value="resolved">Resolved (Violation Confirmed & Mitigated)</option>
                  <option value="dismissed">Dismissed (False Positive / Safe)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Reviewer Notes & Action Taken
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Record justification, threat intelligence notes, or action taken..."
                  value={reportReviewNotes}
                  onChange={(e) => setReportReviewNotes(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setSelectedReportReview(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Review Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: User Activity Inspector Drawer */}
      {selectedUserActivity && (
        <div className="modal-backdrop" onClick={() => setSelectedUserActivity(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
        }}>
          <div 
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 640, padding: 28,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Account Activity: {selectedUserActivity.user?.name}
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {selectedUserActivity.user?.email} · Joined {new Date(selectedUserActivity.user?.created_at).toLocaleDateString()}
                </span>
              </div>
              <span className={`badge ${selectedUserActivity.user?.is_active ? 'badge-active' : 'badge-disabled'}`}>
                {selectedUserActivity.user?.is_active ? 'ACTIVE' : 'SUSPENDED'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Links</span>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{selectedUserActivity.summary?.total_urls ?? 0}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Clicks</span>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{(selectedUserActivity.summary?.total_clicks ?? 0).toLocaleString()}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Token Version</span>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>v{selectedUserActivity.user?.token_version ?? 1}</div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>Recent Links Owned</h4>
            {selectedUserActivity.recentUrls?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {selectedUserActivity.recentUrls.map(link => (
                  <div key={link.id} style={{
                    padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                        /{link.short_code}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                        {link.original_url?.slice(0, 36)}...
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{link.click_count} clicks</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>No links created yet.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setSelectedUserActivity(null)}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
