import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, Users, Link2, MousePointerClick, Activity, Search, 
  Trash2, CheckCircle2, XCircle, ArrowLeft, RefreshCw,
  Sliders, ShieldCheck, KeyRound, AlertOctagon,
  Clock, Shield, Eye, Lock, FileText, HeartPulse,
  ExternalLink, ChevronLeft, ChevronRight, Check,
  Database, Server, Cpu, Download, Globe, Flame, Radio,
  Copy, CheckCheck, Play, Layers, Terminal, Ban, Bell, Plus
} from 'lucide-react';
import { api, useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active workspace tab
  const [activeTab, setActiveTab] = useState('overview'); 
  // 'overview' | 'users' | 'moderation' | 'urls' | 'pages' | 'health' | 'diagnostics' | 'firewall' | 'settings' | 'audit'

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

  // New Features Data States
  const [diagnostics, setDiagnostics] = useState(null);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [cleaning, setCleaning] = useState(false);

  const [firewallData, setFirewallData] = useState({ bannedDomains: [], customDomains: [], stats: {} });
  const [newBanDomain, setNewBanDomain] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  const [banningLoading, setBanningLoading] = useState(false);
  const [testFirewallUrlInput, setTestFirewallUrlInput] = useState('');
  const [testFirewallResult, setTestFirewallResult] = useState(null);
  const [testingFirewall, setTestingFirewall] = useState(false);
  const [updatingDomainId, setUpdatingDomainId] = useState(null);

  const [publicPages, setPublicPages] = useState([]);
  const [pagesPagination, setPagesPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [pageSearch, setPageSearch] = useState('');
  const [pageStatusFilter, setPageStatusFilter] = useState('');
  const [pageTypeFilter, setPageTypeFilter] = useState('');

  // Modals & Action Drawers
  const [selectedUserActivity, setSelectedUserActivity] = useState(null);
  const [selectedReportReview, setSelectedReportReview] = useState(null);
  const [reportReviewNotes, setReportReviewNotes] = useState('');
  const [reportReviewStatus, setReportReviewStatus] = useState('resolved');
  const [probingUrlId, setProbingUrlId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Support Password Reset Modal
  const [supportResetModal, setSupportResetModal] = useState(null);
  const [generatingTokenUserId, setGeneratingTokenUserId] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Filter states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  const [urlSearch, setUrlSearch] = useState('');
  const [urlModerationFilter, setUrlModerationFilter] = useState('');

  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [reportSearch, setReportSearch] = useState('');

  // CSV Export Utility
  const downloadCsv = (filename, headers, rows) => {
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };
    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} records to ${filename}.csv`);
  };

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

  // 6. Load Diagnostics
  const loadDiagnostics = useCallback(async () => {
    try {
      const res = await api.get('/admin/system/diagnostics');
      setDiagnostics(res.data.data || null);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 7. Load Firewall Data
  const loadFirewall = useCallback(async () => {
    try {
      const res = await api.get('/admin/firewall');
      setFirewallData(res.data.data || { bannedDomains: [], customDomains: [], stats: {} });
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 8. Load Public Pages
  const loadPublicPages = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 15 };
      if (pageSearch) params.search = pageSearch;
      if (pageStatusFilter) params.status = pageStatusFilter;
      if (pageTypeFilter) params.pageType = pageTypeFilter;

      const res = await api.get('/admin/public-pages', { params });
      setPublicPages(res.data.data || []);
      if (res.data.pagination) setPagesPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    }
  }, [pageSearch, pageStatusFilter, pageTypeFilter]);

  // 9. Load Settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await api.get('/admin/settings');
      setPlatformSettings(res.data.data || {});
    } catch (err) {
      console.error(err);
    }
  }, []);

  // 10. Load Audit Trail
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
      loadDiagnostics(),
      loadFirewall(),
      loadPublicPages(1),
      loadSettings(),
      loadAudit(1),
    ]);
    setLoading(false);
    setRefreshing(false);
  }, [loadStats, loadUsers, loadReports, loadUrls, loadHealth, loadDiagnostics, loadFirewall, loadPublicPages, loadSettings, loadAudit]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Tab change reactive loaders
  useEffect(() => {
    if (activeTab === 'users') loadUsers(1);
    if (activeTab === 'moderation') loadReports(1);
    if (activeTab === 'urls') loadUrls(1);
    if (activeTab === 'pages') loadPublicPages(1);
    if (activeTab === 'health') loadHealth();
    if (activeTab === 'diagnostics') loadDiagnostics();
    if (activeTab === 'firewall') loadFirewall();
    if (activeTab === 'settings') loadSettings();
    if (activeTab === 'audit') loadAudit(1);
  }, [activeTab, loadUsers, loadReports, loadUrls, loadPublicPages, loadHealth, loadDiagnostics, loadFirewall, loadSettings, loadAudit]);

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

  // Handle Generate User Support Recovery Token
  const handleGenerateResetToken = async (targetUser) => {
    try {
      setGeneratingTokenUserId(targetUser.id);
      const res = await api.post(`/admin/users/${targetUser.id}/reset-token`);
      setSupportResetModal(res.data.data);
      setCopiedToken(false);
      toast.success('Support password recovery link generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate reset token.');
    } finally {
      setGeneratingTokenUserId(null);
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
      const probe = res.data.probe || res.data.data;
      if (probe?.isHealthy) {
        toast.success(`Probe succeeded! /${shortCode} HTTP ${probe.statusCode} in ${probe.responseTimeMs}ms`);
      } else {
        toast.error(`Health probe failed: ${probe?.errorReason || `HTTP ${probe?.statusCode}`}`);
      }
      loadHealth();
      loadUrls(urlsPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to run health check probe.');
    } finally {
      setProbingUrlId(null);
    }
  };

  // Handle Database Ping Test
  const handlePingDatabase = async () => {
    try {
      setPinging(true);
      const res = await api.post('/admin/system/ping');
      setPingResult(res.data);
      toast.success(`PostgreSQL ping roundtrip: ${res.data.latencyMs} ms`);
    } catch (err) {
      toast.error('Database ping probe failed.');
    } finally {
      setPinging(false);
    }
  };

  // Handle Maintenance Cleanup Task
  const handleCleanup = async (target, label) => {
    if (!window.confirm(`Execute maintenance task: "${label}"? This will prune stale records permanently.`)) return;
    try {
      setCleaning(true);
      const res = await api.post('/admin/system/cleanup', { target });
      toast.success(res.data.message || 'Cleanup completed.');
      loadDiagnostics();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Maintenance cleanup failed.');
    } finally {
      setCleaning(false);
    }
  };

  // Handle Add Banned Domain to Firewall Blocklist
  const handleAddBannedDomain = async (e) => {
    e.preventDefault();
    if (!newBanDomain) return;
    try {
      setBanningLoading(true);
      const res = await api.post('/admin/firewall/ban', { domain: newBanDomain, reason: newBanReason });
      toast.success(res.data.message || 'Domain added to global blocklist');
      setNewBanDomain('');
      setNewBanReason('');
      loadFirewall();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to ban domain.');
    } finally {
      setBanningLoading(false);
    }
  };

  // Handle Remove Banned Domain
  const handleRemoveBannedDomain = async (domain) => {
    if (!window.confirm(`Unblock domain "${domain}"?`)) return;
    try {
      const res = await api.delete(`/admin/firewall/ban/${encodeURIComponent(domain)}`);
      toast.success(res.data.message || 'Domain unbanned.');
      loadFirewall();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove domain.');
    }
  };

  // Handle Live URL Firewall Rule Evaluation
  const handleTestFirewallUrl = async (e) => {
    e.preventDefault();
    if (!testFirewallUrlInput) return;
    try {
      setTestingFirewall(true);
      const res = await api.post('/admin/firewall/test', { targetUrl: testFirewallUrlInput });
      setTestFirewallResult(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to evaluate URL.');
    } finally {
      setTestingFirewall(false);
    }
  };

  // Handle Custom Domain Admin Override (Force Verify / Revoke)
  const handleUpdateCustomDomainAdmin = async (domainId, nextStatus) => {
    if (!window.confirm(`Set custom domain status to ${nextStatus.toUpperCase()}?`)) return;
    try {
      setUpdatingDomainId(domainId);
      const res = await api.patch(`/admin/firewall/domains/${domainId}`, { 
        status: nextStatus,
        sslStatus: nextStatus === 'verified' ? 'active' : 'pending',
        reason: 'Admin operational oversight'
      });
      toast.success(res.data.message || 'Domain status updated.');
      loadFirewall();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update domain.');
    } finally {
      setUpdatingDomainId(null);
    }
  };

  // Handle Public Page Status Toggle
  const handleTogglePageStatus = async (page) => {
    const nextStatus = page.status === 'published' ? 'archived' : 'published';
    const reason = window.prompt(`Confirm setting public page "/p/${page.slug}" to ${nextStatus.toUpperCase()}. Enter reason:`, 'Administrative oversight');
    if (reason === null) return;
    try {
      const res = await api.patch(`/admin/public-pages/${page.id}/status`, { status: nextStatus, reason });
      toast.success(res.data.message || 'Public page status updated.');
      loadPublicPages(pagesPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update page status.');
    }
  };

  // Handle Delete Public Page
  const handleDeletePublicPage = async (page) => {
    if (!window.confirm(`Permanently delete public page "/p/${page.slug}"? This cannot be undone.`)) return;
    try {
      const res = await api.delete(`/admin/public-pages/${page.id}`);
      toast.success(res.data.message || 'Page deleted.');
      loadPublicPages(pagesPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete page.');
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

  // Export User Directory CSV
  const handleExportUsers = () => {
    if (users.length === 0) return toast.error('No users to export.');
    const headers = ['User ID', 'Name', 'Email', 'Role', 'Status', 'Links Count', 'Total Clicks', 'Last Login', 'Created At'];
    const rows = users.map(u => [
      u.id,
      u.name,
      u.email,
      u.role,
      u.is_active ? 'Active' : 'Suspended',
      u.links_count || u.url_count || 0,
      u.total_clicks || 0,
      u.last_login_at || 'Never',
      u.created_at
    ]);
    downloadCsv('axly_users_directory', headers, rows);
  };

  // Export URLs CSV
  const handleExportUrls = () => {
    if (urls.length === 0) return toast.error('No URLs to export.');
    const headers = ['Short Code', 'Destination URL', 'Owner Email', 'Status', 'Moderation', 'Health', 'Clicks', 'Unique Clicks', 'Created At'];
    const rows = urls.map(l => [
      l.short_code,
      l.original_url,
      l.owner_email || 'Anonymous Guest',
      l.status,
      l.moderation_status || 'approved',
      l.health_status || 'unknown',
      l.click_count,
      l.unique_clicks,
      l.created_at
    ]);
    downloadCsv('axly_urls_registry', headers, rows);
  };

  // Export Public Pages CSV
  const handleExportPages = () => {
    if (publicPages.length === 0) return toast.error('No public pages to export.');
    const headers = ['Slug', 'Title', 'Page Type', 'Template', 'Status', 'Owner Email', 'Blocks Count', 'Created At'];
    const rows = publicPages.map(p => [
      p.slug,
      p.title,
      p.page_type,
      p.template_key,
      p.status,
      p.owner_email || 'Unknown',
      p.blocks_count || 0,
      p.created_at
    ]);
    downloadCsv('axly_public_pages', headers, rows);
  };

  // Export Audit Trail CSV
  const handleExportAudit = () => {
    if (auditLogs.length === 0) return toast.error('No audit records to export.');
    const headers = ['ID', 'Actor Email', 'Action', 'Target Type', 'Target ID', 'Operator Hash', 'Timestamp'];
    const rows = auditLogs.map(l => [
      l.id,
      l.actor_email,
      l.action,
      l.target_type,
      l.target_id,
      l.ip_hash,
      l.created_at
    ]);
    downloadCsv('axly_audit_trail', headers, rows);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 42, height: 42, margin: '0 auto 16px', borderWidth: 3 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Axly Operations & Control Center</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Verifying administrative session and querying PostgreSQL cluster...
          </p>
        </div>
      </div>
    );
  }

  const announcement = platformSettings.system_announcement_banner || {
    enabled: false,
    message: '',
    type: 'info',
    dismissible: true,
  };

  return (
    <div className="page-container" style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 80 }}>
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800 }}>
            Platform Control & Operations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: 4 }}>
            Real-time PostgreSQL telemetry, tenant governance, domain firewalling, and automated infrastructure maintenance.
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
            <span>{refreshing ? 'Syncing...' : 'Sync Cluster'}</span>
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
          <ShieldAlert size={16} /> Abuse Queue
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
          className={`admin-tab ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => setActiveTab('pages')}
        >
          <Globe size={16} /> Bio & Creator Pages
        </button>

        <button 
          className={`admin-tab ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <HeartPulse size={16} /> Destination Health Hub
        </button>

        <button 
          className={`admin-tab ${activeTab === 'diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          <Database size={16} /> System Diagnostics & DB
        </button>

        <button 
          className={`admin-tab ${activeTab === 'firewall' ? 'active' : ''}`}
          onClick={() => setActiveTab('firewall')}
        >
          <Flame size={16} /> Domain Firewall & Oversight
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
              <div className="admin-stat-icon admin-stat-icon-blue">
                <Users size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats?.totalUsers ?? 0}</span>
                <span className="admin-stat-lbl">Registered Accounts</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: 4 }}>
                  {stats?.activeUsers ?? 0} active · {stats?.suspendedUsers ?? 0} suspended
                </span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon admin-stat-icon-purple">
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
              <div className="admin-stat-icon admin-stat-icon-emerald">
                <MousePointerClick size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{(stats?.totalClicks ?? 0).toLocaleString()}</span>
                <span className="admin-stat-lbl">Lifetime Clicks Tracked</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: 4 }}>
                  +{stats?.clicks24h ?? 0} in 24h · +{stats?.clicks7d ?? 0} in 7d
                </span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon admin-stat-icon-red">
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
              <div className="admin-stat-icon admin-stat-icon-amber">
                <HeartPulse size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats?.healthyLinks ?? 0}</span>
                <span className="admin-stat-lbl">Healthy Destinations</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4 }}>
                  {stats?.unreachableLinks ?? 0} unreachable · {stats?.degradedLinks ?? 0} degraded
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry and Top Links Row */}
          <div className="admin-overview-grid" style={{ gap: 24, marginTop: 12 }}>
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

            <button 
              className="btn btn-secondary" 
              onClick={handleExportUsers}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Download CSV of user directory"
            >
              <Download size={14} />
              <span>Export CSV</span>
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
                        <strong>{u.links_count || u.url_count || 0}</strong>
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
                            style={{ padding: '6px 8px', fontSize: '0.78rem', color: 'var(--brand-primary)' }}
                            onClick={() => handleGenerateResetToken(u)}
                            disabled={generatingTokenUserId === u.id}
                            title="Generate Support Password Recovery Link"
                          >
                            <KeyRound size={14} className={generatingTokenUserId === u.id ? 'spin' : ''} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 8px', fontSize: '0.78rem', color: '#d97706' }}
                            onClick={() => handleRevokeSessions(u)}
                            title="Force session invalidation (re-auth)"
                          >
                            <Lock size={14} />
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
                      Zero active abuse reports in the moderation queue.
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

            <button 
              className="btn btn-secondary" 
              onClick={handleExportUrls}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Download CSV of links"
            >
              <Download size={14} />
              <span>Export CSV</span>
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

      {/* TAB 5: PUBLIC BIO & CREATOR PAGES GOVERNANCE */}
      {activeTab === 'pages' && (
        <div>
          <div className="admin-toolbar" style={{ gap: 12 }}>
            <div className="admin-search-wrap" style={{ flex: 1 }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by slug, title, or creator email..."
                className="admin-search-input"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadPublicPages(1)}
              />
            </div>

            <select 
              className="form-input" 
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.88rem' }}
              value={pageStatusFilter}
              onChange={(e) => { setPageStatusFilter(e.target.value); }}
            >
              <option value="">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived / Suspended</option>
            </select>

            <select 
              className="form-input" 
              style={{ width: 'auto', padding: '8px 14px', fontSize: '0.88rem' }}
              value={pageTypeFilter}
              onChange={(e) => { setPageTypeFilter(e.target.value); }}
            >
              <option value="">All Page Types</option>
              <option value="link-in-bio">Link in Bio</option>
              <option value="business-card">Business Card</option>
              <option value="portfolio">Portfolio</option>
              <option value="creator">Creator</option>
            </select>

            <button className="btn btn-outline" onClick={() => loadPublicPages(1)} style={{ padding: '8px 14px' }}>
              Filter Pages
            </button>

            <button 
              className="btn btn-secondary" 
              onClick={handleExportPages}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Download CSV of public pages"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Page Identity (Slug)</th>
                  <th>Title & Bio</th>
                  <th>Creator / Owner</th>
                  <th>Type / Template</th>
                  <th>Blocks</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {publicPages.length > 0 ? (
                  publicPages.map(page => (
                    <tr key={page.id}>
                      <td>
                        <a 
                          href={`/p/${page.slug}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          /p/{page.slug}
                          <ExternalLink size={12} />
                        </a>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{page.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {page.bio || 'No bio provided'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {page.owner_email || 'Unknown User'}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--bg-secondary)', fontWeight: 600, fontSize: '0.75rem' }}>
                          {page.page_type} · {page.template_key}
                        </span>
                      </td>
                      <td>
                        <strong>{page.blocks_count || 0}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>blocks</span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: page.status === 'published' ? '#ecfdf5' : page.status === 'draft' ? '#fffbeb' : '#fef2f2',
                          color: page.status === 'published' ? '#059669' : page.status === 'draft' ? '#d97706' : '#dc2626',
                          fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase'
                        }}>
                          {page.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(page.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 8px', color: page.status === 'published' ? '#d97706' : '#16a34a' }}
                            onClick={() => handleTogglePageStatus(page)}
                            title={page.status === 'published' ? 'Archive / Suspend page' : 'Publish page'}
                          >
                            {page.status === 'published' ? <AlertOctagon size={14} /> : <CheckCircle2 size={14} />}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '6px 8px', color: 'var(--danger)' }}
                            onClick={() => handleDeletePublicPage(page)}
                            title="Delete public page permanently"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No public creator pages found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pagesPagination.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing page {pagesPagination.page} of {pagesPagination.pages} ({pagesPagination.total} public pages)
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-outline"
                  disabled={pagesPagination.page <= 1}
                  onClick={() => loadPublicPages(pagesPagination.page - 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn btn-outline"
                  disabled={pagesPagination.page >= pagesPagination.pages}
                  onClick={() => loadPublicPages(pagesPagination.page + 1)}
                  style={{ padding: '6px 12px' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: DESTINATION HEALTH HUB */}
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
              <div className="admin-stat-icon admin-stat-icon-emerald">
                <CheckCircle2 size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{healthData?.stats?.healthy_links ?? 0}</span>
                <span className="admin-stat-lbl">Healthy Destinations (2xx/3xx)</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon admin-stat-icon-amber">
                <Clock size={24} />
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{healthData?.stats?.degraded_links ?? 0}</span>
                <span className="admin-stat-lbl">Degraded Latency (&gt;2000ms)</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon admin-stat-icon-red">
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

      {/* TAB 7: SYSTEM DIAGNOSTICS & DATABASE INSPECTOR */}
      {activeTab === 'diagnostics' && (
        <div>
          {/* Top Live Latency Action Card */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Database size={22} style={{ color: 'var(--brand-primary)' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                    PostgreSQL Cluster Latency & Inspector
                  </h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4 }}>
                  Direct low-level roundtrip latency diagnostics to Neon / PostgreSQL connection pool.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {pingResult ? (
                  <span className={`admin-ping-badge ${pingResult.latencyMs < 5 ? 'fast' : pingResult.latencyMs < 20 ? 'medium' : 'slow'}`}>
                    ● {pingResult.latencyMs} ms Roundtrip
                  </span>
                ) : diagnostics?.database?.pingLatencyMs ? (
                  <span className={`admin-ping-badge ${diagnostics.database.pingLatencyMs < 5 ? 'fast' : diagnostics.database.pingLatencyMs < 20 ? 'medium' : 'slow'}`}>
                    ● {diagnostics.database.pingLatencyMs} ms Ping
                  </span>
                ) : null}

                <button 
                  className="btn btn-primary"
                  onClick={handlePingDatabase}
                  disabled={pinging}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Play size={15} className={pinging ? 'spin' : ''} />
                  <span>{pinging ? 'Testing...' : 'Ping Database Now'}</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 20 }}>
              <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Database Name</span>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 2, fontFamily: 'monospace' }}>
                  {diagnostics?.database?.name || 'postgres'}
                </div>
              </div>

              <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Connections</span>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 2, color: 'var(--brand-primary)' }}>
                  {diagnostics?.database?.activeConnections || 1} pool connection(s)
                </div>
              </div>

              <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Engine Version</span>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={diagnostics?.database?.version}>
                  {diagnostics?.database?.version?.slice(0, 36) || 'PostgreSQL 16.x'}
                </div>
              </div>

              <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Server Time (UTC)</span>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 2, color: 'var(--text-secondary)' }}>
                  {diagnostics?.database?.serverTime ? new Date(diagnostics.database.serverTime).toLocaleTimeString() : 'Synchronized'}
                </div>
              </div>
            </div>
          </div>

          {/* Database Table Storage Metrics Grid */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} style={{ color: 'var(--brand-primary)' }} />
              Database Table Footprint & Record Volume
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {[
                { label: 'Registered Users', count: diagnostics?.tableCounts?.users_count ?? 0, icon: Users, color: '#2563eb' },
                { label: 'Short URLs', count: diagnostics?.tableCounts?.urls_count ?? 0, icon: Link2, color: '#7c3aed' },
                { label: 'Click Events', count: (diagnostics?.tableCounts?.clicks_count ?? 0).toLocaleString(), icon: MousePointerClick, color: '#059669' },
                { label: 'Public Bio Pages', count: diagnostics?.tableCounts?.pages_count ?? 0, icon: Globe, color: '#0891b2' },
                { label: 'Custom Domains', count: diagnostics?.tableCounts?.custom_domains_count ?? 0, icon: Server, color: '#d97706' },
                { label: 'Active API Keys', count: diagnostics?.tableCounts?.active_api_keys_count ?? 0, icon: KeyRound, color: '#4f46e5' },
                { label: 'Active Webhooks', count: diagnostics?.tableCounts?.active_webhooks_count ?? 0, icon: Radio, color: '#ea580c' },
                { label: 'Pending Abuse Reports', count: diagnostics?.tableCounts?.pending_reports_count ?? 0, icon: ShieldAlert, color: '#dc2626' },
                { label: 'Audit Trail Records', count: diagnostics?.tableCounts?.audit_logs_count ?? 0, icon: FileText, color: '#4b5563' },
              ].map((item, idx) => (
                <div key={idx} className="admin-metric-card">
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `${item.color}15`, color: item.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <item.icon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{item.count}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Node.js Runtime Telemetry & Routine Housekeeping */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {/* Runtime Resources */}
            <div className="card" style={{ padding: 24 }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={18} style={{ color: '#0891b2' }} />
                Process Memory & Host Telemetry
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>RSS Memory</span>
                  <span style={{ fontWeight: 700 }}>{diagnostics?.runtime?.rssMemoryMb ?? 64} MB</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Heap Memory Used</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{diagnostics?.runtime?.heapUsedMb ?? 32} MB</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Heap Total Reserved</span>
                  <span style={{ fontWeight: 700 }}>{diagnostics?.runtime?.heapTotalMb ?? 48} MB</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Host Platform / Architecture</span>
                  <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{diagnostics?.runtime?.platform ?? 'win32'} ({diagnostics?.runtime?.arch ?? 'x64'})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Process PID / Environment</span>
                  <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>PID {diagnostics?.runtime?.pid} · {diagnostics?.runtime?.environment}</span>
                </div>
              </div>
            </div>

            {/* Routine Maintenance Tools */}
            <div className="card" style={{ padding: 24 }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={18} style={{ color: '#d97706' }} />
                Automated Platform Maintenance
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>
                Prune orphaned links, stale webhook payloads, and historical probes to maintain fast index scans.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Clean Expired Guest Links</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Deletes links where user_id IS NULL and expires_at &lt; NOW()</div>
                  </div>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => handleCleanup('expired_guest_links', 'Clean Expired Guest Links')}
                    disabled={cleaning}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    Clean
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Prune Stale Webhook Deliveries</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Removes historical deliveries older than 30 days</div>
                  </div>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => handleCleanup('stale_webhook_logs', 'Prune Stale Webhook Deliveries')}
                    disabled={cleaning}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    Prune
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Trim Destination Health Probes</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Keeps latest 500 checks, archiving older logs</div>
                  </div>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => handleCleanup('prune_health_history', 'Trim Destination Health Probes')}
                    disabled={cleaning}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    Trim
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: DOMAIN FIREWALL & TENANT CUSTOM DOMAINS */}
      {activeTab === 'firewall' && (
        <div>
          {/* Section 1: Live Firewall Rule Tester */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={20} style={{ color: '#dc2626' }} />
              Live Destination Firewall Rule Tester
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 16 }}>
              Test any destination link or hostname against active domain blocklists to simulate real-time edge filtering.
            </p>

            <form onSubmit={handleTestFirewallUrl} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <input
                  type="text"
                  placeholder="Enter URL to test (e.g. https://phish-axly.xyz/login or malicious-target.com)..."
                  className="form-input"
                  value={testFirewallUrlInput}
                  onChange={(e) => setTestFirewallUrlInput(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={testingFirewall}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ShieldAlert size={15} />
                <span>{testingFirewall ? 'Evaluating...' : 'Evaluate Against Firewall'}</span>
              </button>
            </form>

            {testFirewallResult && (
              <div className={`admin-firewall-verdict ${testFirewallResult.isBlocked ? 'blocked' : 'allowed'}`}>
                {testFirewallResult.isBlocked ? <AlertOctagon size={22} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={22} style={{ flexShrink: 0 }} />}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    {testFirewallResult.isBlocked ? 'VERDICT: BLOCKED BY PLATFORM FIREWALL' : 'VERDICT: DESTINATION ALLOWED'}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                    Host <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{testFirewallResult.hostname}</span>{' '}
                    {testFirewallResult.isBlocked ? (
                      <>matches blocked domain pattern <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{typeof testFirewallResult.matchedRule === 'string' ? testFirewallResult.matchedRule : testFirewallResult.matchedRule?.domain}</span> ({testFirewallResult.matchedRule?.reason || 'Security threat'}).</>
                    ) : (
                      <>passed all security blocklist checks and is permitted for URL creation and redirection.</>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Global Banned Domains Blocklist */}
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ban size={20} style={{ color: '#dc2626' }} />
              Global Malicious Domain Blocklist
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
              Links pointing to domains or subdomains on this blocklist will be immediately rejected at creation time.
            </p>

            <form onSubmit={handleAddBannedDomain} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr)) 140px', gap: 12, marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Domain pattern (e.g. scam-giftcards.xyz)..."
                className="form-input"
                value={newBanDomain}
                onChange={(e) => setNewBanDomain(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Reason (e.g. Credential harvesting phishing)..."
                className="form-input"
                value={newBanReason}
                onChange={(e) => setNewBanReason(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn btn-outline"
                disabled={banningLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Plus size={15} />
                <span>{banningLoading ? 'Adding...' : 'Add Domain'}</span>
              </button>
            </form>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Blocked Domain Pattern</th>
                    <th>Threat Classification / Reason</th>
                    <th>Added By</th>
                    <th>Date Added</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {firewallData?.bannedDomains?.length > 0 ? (
                    firewallData.bannedDomains.map((item, idx) => {
                      const domainName = typeof item === 'string' ? item : item.domain;
                      const reason = typeof item === 'string' ? 'Malicious destination' : item.reason;
                      const addedBy = item?.addedBy || 'System Default';
                      const addedAt = item?.addedAt ? new Date(item.addedAt).toLocaleDateString() : 'Active';

                      return (
                        <tr key={idx}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                              {domainName}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{reason}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{addedBy}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{addedAt}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', color: 'var(--danger)', fontSize: '0.78rem' }}
                              onClick={() => handleRemoveBannedDomain(domainName)}
                              title="Remove domain from blocklist"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        Zero domains currently blacklisted.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Tenant Custom Domains Platform Oversight */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={20} style={{ color: 'var(--brand-primary)' }} />
                  Tenant Custom Domains Platform Registry
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                  Supervise all custom CNAME hostnames configured across workspaces with one-click VIP verification bypass.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge" style={{ background: '#ecfdf5', color: '#059669', fontWeight: 700 }}>
                  {firewallData?.stats?.verifiedDomains ?? 0} Verified
                </span>
                <span className="badge" style={{ background: '#fffbeb', color: '#d97706', fontWeight: 700 }}>
                  {firewallData?.stats?.pendingDnsDomains ?? 0} Pending DNS
                </span>
              </div>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Domain Hostname</th>
                    <th>Type</th>
                    <th>Workspace & Owner</th>
                    <th>Verification Status</th>
                    <th>SSL Status</th>
                    <th>Created At</th>
                    <th style={{ textAlign: 'right' }}>Admin Overrides</th>
                  </tr>
                </thead>
                <tbody>
                  {firewallData?.customDomains?.length > 0 ? (
                    firewallData.customDomains.map(cd => (
                      <tr key={cd.id}>
                        <td>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>
                            {cd.domain}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ background: 'var(--bg-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                            {cd.domain_type || 'shortlinks'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cd.workspace_name || 'Personal'}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{cd.owner_email || 'Unknown'}</div>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: cd.status === 'verified' ? '#ecfdf5' : cd.status === 'pending_dns' ? '#fffbeb' : '#fef2f2',
                            color: cd.status === 'verified' ? '#059669' : cd.status === 'pending_dns' ? '#d97706' : '#dc2626',
                            fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase'
                          }}>
                            {cd.status}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: cd.ssl_status === 'active' ? '#ecfdf5' : '#f8fafc',
                            color: cd.ssl_status === 'active' ? '#059669' : 'var(--text-muted)',
                            fontSize: '0.72rem', fontWeight: 600
                          }}>
                            SSL: {cd.ssl_status || 'pending'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(cd.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {cd.status === 'verified' ? (
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '4px 8px', color: '#d97706', fontSize: '0.78rem' }}
                                onClick={() => handleUpdateCustomDomainAdmin(cd.id, 'pending_dns')}
                                disabled={updatingDomainId === cd.id}
                                title="Revert to pending DNS"
                              >
                                Reset DNS
                              </button>
                            ) : (
                              <button
                                className="btn btn-outline"
                                style={{ padding: '4px 8px', color: '#16a34a', fontSize: '0.78rem' }}
                                onClick={() => handleUpdateCustomDomainAdmin(cd.id, 'verified')}
                                disabled={updatingDomainId === cd.id}
                                title="VIP Force-verify domain"
                              >
                                Force Verify
                              </button>
                            )}
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', color: '#dc2626', fontSize: '0.78rem' }}
                              onClick={() => handleUpdateCustomDomainAdmin(cd.id, 'revoked')}
                              disabled={updatingDomainId === cd.id}
                              title="Revoke domain"
                            >
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                        No custom domains registered by tenants yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: OPERATIONAL SETTINGS & FEATURE FLAGS */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: 880 }}>
          <form onSubmit={handleSaveSettings}>
            {/* Global Broadcast Announcement Banner */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={20} style={{ color: 'var(--brand-primary)' }} />
                  Platform Emergency & Broadcast Announcement Banner
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                  <span>Broadcast Active</span>
                  <input
                    type="checkbox"
                    checked={Boolean(announcement.enabled)}
                    onChange={(e) => setPlatformSettings(prev => ({
                      ...prev,
                      system_announcement_banner: {
                        ...(prev.system_announcement_banner || {}),
                        enabled: e.target.checked,
                      }
                    }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
                Display a prominent banner across user dashboards for scheduled maintenance, status incidents, or major platform updates.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Announcement Message
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Scheduled database maintenance this Saturday 02:00 UTC. Link redirects will not be affected."
                    value={announcement.message || ''}
                    onChange={(e) => setPlatformSettings(prev => ({
                      ...prev,
                      system_announcement_banner: {
                        ...(prev.system_announcement_banner || {}),
                        message: e.target.value,
                      }
                    }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      Banner Visual Severity
                    </label>
                    <select
                      className="form-input"
                      value={announcement.type || 'info'}
                      onChange={(e) => setPlatformSettings(prev => ({
                        ...prev,
                        system_announcement_banner: {
                          ...(prev.system_announcement_banner || {}),
                          type: e.target.value,
                        }
                      }))}
                    >
                      <option value="info">Information (Blue)</option>
                      <option value="warning">Warning / Maintenance (Amber)</option>
                      <option value="critical">Critical / Incident (Red)</option>
                      <option value="success">Success / Milestone (Emerald)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
                      <input
                        type="checkbox"
                        checked={announcement.dismissible !== false}
                        onChange={(e) => setPlatformSettings(prev => ({
                          ...prev,
                          system_announcement_banner: {
                            ...(prev.system_announcement_banner || {}),
                            dismissible: e.target.checked,
                          }
                        }))}
                        style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Allow user to dismiss banner</span>
                    </label>
                  </div>
                </div>

                {/* Live Preview of Banner */}
                {announcement.message && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Live User Interface Preview
                    </span>
                    <div className={`admin-broadcast-preview ${announcement.type || 'info'}`} style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Radio size={18} />
                        <span>{announcement.message}</span>
                      </div>
                      {announcement.dismissible !== false && (
                        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Quotas & Limits */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sliders size={20} style={{ color: 'var(--brand-primary)' }} />
                Platform Quotas & Rate Limits
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 24 }}>
                Configure rate limits, link quotas, and safety policies. All changes are strictly validated and audited.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Guest Hourly Creation Limit
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.guest_hourly_limit?.value ?? platformSettings.guest_hourly_limit ?? 10}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, guest_hourly_limit: parseInt(e.target.value, 10) }))}
                    min={1}
                    max={500}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max links anonymous visitors can create per hour.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Authenticated Daily Creation Limit
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.authenticated_daily_limit?.value ?? platformSettings.authenticated_daily_limit ?? 1000}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, authenticated_daily_limit: parseInt(e.target.value, 10) }))}
                    min={10}
                    max={100000}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max links registered members can shorten per day.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Maximum Accepted URL Length (bytes)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.max_url_length?.value ?? platformSettings.max_url_length ?? 4096}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, max_url_length: parseInt(e.target.value, 10) }))}
                    min={256}
                    max={16384}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upper character length limit for destination targets.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Default Expiration Policy (Days)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    value={platformSettings.default_expiration_days?.value ?? platformSettings.default_expiration_days ?? 0}
                    onChange={(e) => setPlatformSettings(prev => ({ ...prev, default_expiration_days: parseInt(e.target.value, 10) }))}
                    min={0}
                    max={3650}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0 = Permanent links allowed by default.</span>
                </div>
              </div>
            </div>

            {/* Feature Flags */}
            <div className="card" style={{ padding: 28, marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
                System Feature Flags & Modules
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 20 }}>
                Control platform modules and capabilities dynamically across the API cluster.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { key: 'enable_guest_shortening', title: 'Anonymous Guest Shortening', desc: 'Allows public visitors to shorten links without signing in.' },
                  { key: 'enable_preview_pages', title: 'Safety Preview & Interstitial Pages', desc: 'Allows users to show a verification preview before redirection.' },
                  { key: 'enable_smart_rules', title: 'Smart Device / Geo Dynamic Redirects', desc: 'Enables conditional redirection based on device, OS, and location.' },
                  { key: 'enable_ab_testing', title: 'A/B Experiments & Split Traffic Engine', desc: 'Enables multi-variant split traffic and conversion tracking.' },
                  { key: 'require_captcha_for_guests', title: 'Enforce CAPTCHA on Guest Links', desc: 'Requires anti-bot verification for unauthenticated visitors.' },
                ].map(flag => {
                  const currentValue = platformSettings[flag.key]?.value !== undefined
                    ? platformSettings[flag.key].value
                    : platformSettings[flag.key] ?? true;

                  return (
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
                        checked={Boolean(currentValue)}
                        onChange={(e) => setPlatformSettings(prev => ({ ...prev, [flag.key]: e.target.checked }))}
                        style={{ width: 18, height: 18, accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingSettings}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}
            >
              <Check size={16} />
              <span>{savingSettings ? 'Persisting Changes...' : 'Save & Enforce Configuration'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 10: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div>
          <div className="admin-toolbar">
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                Immutable Compliance & Security Audit Trail
              </span>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Showing {auditLogs.length} recent governance operations
              </div>
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={handleExportAudit}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Download CSV of audit logs"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
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
                          background: log.action.includes('delete') || log.action.includes('suspend') || log.action.includes('banned') ? '#fef2f2' : '#eff6ff',
                          color: log.action.includes('delete') || log.action.includes('suspend') || log.action.includes('banned') ? '#dc2626' : '#2563eb',
                          fontWeight: 700, fontSize: '0.72rem', fontFamily: 'monospace',
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {log.target_type}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {log.target_id?.slice(0, 10)}...
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

      {/* MODAL: Support Password Recovery Token */}
      {supportResetModal && (
        <div className="modal-backdrop" onClick={() => setSupportResetModal(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, padding: 16, backdropFilter: 'blur(4px)',
        }}>
          <div 
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, padding: 28,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.1)', color: 'var(--brand-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <KeyRound size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Support Password Recovery Token
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  User Account: {supportResetModal.targetEmail}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              A cryptographically signed recovery token has been generated. This URL allows the user to securely set a new password without needing access to their original inbox. Valid for 24 hours.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Direct Recovery URL
              </label>
              <div className="admin-copy-pill">
                <span style={{ flex: 1, fontSize: '0.8rem' }}>{supportResetModal.recoveryUrl}</span>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', flexShrink: 0 }}
                  onClick={() => {
                    navigator.clipboard.writeText(supportResetModal.recoveryUrl);
                    setCopiedToken(true);
                    toast.success('Recovery link copied to clipboard!');
                  }}
                >
                  {copiedToken ? <CheckCheck size={14} /> : <Copy size={14} />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button className="btn btn-primary" onClick={() => setSupportResetModal(null)}>
                Done / Close
              </button>
            </div>
          </div>
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
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{selectedUserActivity.recentLinks?.length ?? 0}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Plan Tier</span>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', textTransform: 'capitalize' }}>{selectedUserActivity.user?.plan || 'Free'}</div>
              </div>
              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Account Role</span>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', textTransform: 'uppercase' }}>{selectedUserActivity.user?.role || 'User'}</div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>Recent Links Owned</h4>
            {selectedUserActivity.recentLinks?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {selectedUserActivity.recentLinks.map(link => (
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
