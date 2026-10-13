import { useState, useEffect, useRef } from 'react';
import { Navigate, Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Bell, Check, AlertCircle, Info, Menu, X, Sun, Moon,
  LayoutDashboard, Link2, Plus, BarChart3, MoreHorizontal
} from 'lucide-react';
import Sidebar from './Sidebar';
import BrandMark from './BrandMark';
import CreateLinkModal from './CreateLinkModal';
import toast from 'react-hot-toast';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Silently ignore background polling errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000); // 45s poll
    return () => clearInterval(interval);
  }, [user]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => n.is_read ? n : { ...n, is_read: true }));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px',
            background: 'var(--brand-gradient)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900,
            color: '#fff', fontFamily: 'var(--font-display)',
            boxShadow: '0 0 30px rgba(124,58,237,0.4)',
            animation: 'pulse 1.5s ease infinite',
          }}>A</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading Axly Studio...</div>
        </div>
        <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.95);opacity:0.8} }`}</style>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      {/* Sidebar with mobile drawer state */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-main-wrapper">
        {/* Top Header Actions Bar */}
        <header className="app-topbar">
          {/* Left: Mobile Hamburger & Brand / Desktop Breadcrumb */}
          <div className="app-topbar-left">
            <button
              onClick={() => setSidebarOpen(p => !p)}
              className="mobile-only"
              style={{
                width: 38, height: 38, borderRadius: 10,
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', cursor: 'pointer',
              }}
              aria-label="Toggle navigation drawer"
              id="mobile-nav-toggle-btn"
            >
              <Menu size={20} />
            </button>

            <Link to="/app/dashboard" className="mobile-brand-title mobile-only">
              <div className="logo-icon"><BrandMark size={20} /></div>
              <span>Axly Studio</span>
            </Link>

            {/* Desktop Display Workspace Context */}
            <div className="desktop-workspace-indicator desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                <span>Live Studio</span>
              </div>
            </div>
          </div>

          {/* Right: Theme Toggle & Notifications Center */}
          <div className="app-topbar-right">
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              style={{ width: 38, height: 38 }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(p => !p)}
                className="btn btn-secondary btn-sm"
                style={{
                  position: 'relative', width: 38, height: 38, borderRadius: 10,
                  padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                aria-label="In-App Notifications"
                id="notifications-bell"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    background: 'var(--danger)', color: '#fff',
                    borderRadius: 10, fontSize: '0.65rem', fontWeight: 700,
                    minWidth: 18, height: 18, padding: '0 4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Modal */}
              {dropdownOpen && (
                <div className="notifications-dropdown" style={{
                  position: 'absolute', top: 48, right: 0,
                  width: 340, maxWidth: 'calc(100vw - 32px)', maxHeight: 420, overflowY: 'auto',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
                  zIndex: 100, display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        style={{
                          background: 'none', border: 'none', color: 'var(--brand-primary)',
                          fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          style={{
                            padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                            background: n.is_read ? 'transparent' : 'rgba(124,58,237,0.04)',
                            display: 'flex', gap: 12, alignItems: 'flex-start',
                          }}
                        >
                          <div style={{ marginTop: 2, color: n.type === 'alert' ? 'var(--danger)' : 'var(--brand-primary)' }}>
                            {n.type === 'alert' ? <AlertCircle size={16} /> : <Info size={16} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                              {n.title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                              {n.message}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {!n.is_read && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              style={{
                                background: 'none', border: 'none', color: 'var(--text-muted)',
                                cursor: 'pointer', padding: 2,
                              }}
                              title="Mark as read"
                            >
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="main-content" style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>

      {/* Modern App Bottom Navigation Bar for Mobile */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <NavLink
          to="/app/dashboard"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={19} />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/app/links"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <Link2 size={19} />
          <span>Links</span>
        </NavLink>

        {/* Quick Create Link Floating Button */}
        <button
          className="bottom-nav-create"
          onClick={() => setQuickCreateOpen(true)}
          aria-label="Create New Link"
          title="Create Short Link"
        >
          <Plus size={22} />
        </button>

        <NavLink
          to="/app/analytics"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <BarChart3 size={19} />
          <span>Analytics</span>
        </NavLink>

        <button
          className="bottom-nav-item"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open More Menu"
        >
          <MoreHorizontal size={19} />
          <span>More</span>
        </button>
      </nav>

      {/* Global Quick Create Modal */}
      {quickCreateOpen && (
        <CreateLinkModal
          onClose={() => setQuickCreateOpen(false)}
          onCreated={() => setQuickCreateOpen(false)}
        />
      )}
    </div>
  );
}
