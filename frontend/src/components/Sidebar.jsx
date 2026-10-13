import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Link2, Settings, LogOut,
  Moon, Sun, Menu, X, ChevronRight, ShieldAlert,
  Megaphone, GitCompare, FileSpreadsheet, BarChart3,
  Users, Code2, UserRound, PanelsTopLeft, Globe, QrCode,
} from 'lucide-react';
import AxlyLogo from './AxlyLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const NAV_GROUPS = [
  {
    title: 'Create',
    items: [
      { to: '/app/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { to: '/app/qr', icon: <QrCode size={18} />, label: 'QR Codes' },
      { to: '/app/pages', icon: <PanelsTopLeft size={18} />, label: 'My Pages' },
    ]
  },
  {
    title: 'Manage',
    items: [
      { to: '/app/links', icon: <Link2 size={18} />, label: 'My Links' },
      { to: '/app/domains', icon: <Globe size={18} />, label: 'Domains' },
      { to: '/app/campaigns', icon: <Megaphone size={18} />, label: 'Campaigns & UTM' },
      { to: '/app/experiments', icon: <GitCompare size={18} />, label: 'A/B Experiments' },
      { to: '/app/analytics', icon: <BarChart3 size={18} />, label: 'Account Analytics' },
    ]
  },
  {
    title: 'Workspace',
    items: [
      { to: '/app/teams', icon: <Users size={18} />, label: 'Teams & Workspaces' },
      { to: '/app/developer', icon: <Code2 size={18} />, label: 'Developer Platform' },
      { to: '/app/bulk', icon: <FileSpreadsheet size={18} />, label: 'Bulk Import/Export' },
    ]
  },
  {
    title: 'Account',
    items: [
      { to: '/app/profile', icon: <UserRound size={18} />, label: 'My Account Profile' },
      { to: '/app/settings', icon: <Settings size={18} />, label: 'Settings' },
    ]
  }
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);

  const isSidebarOpen = isOpen !== undefined ? isOpen : internalOpen;
  const handleClose = () => {
    if (onClose) onClose();
    else setInternalOpen(false);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Overlay for mobile drawer */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, backdropFilter: 'blur(4px)' }}
          onClick={handleClose}
        />
      )}

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        {/* Studio Branding */}
        <div className="sidebar-logo">
          <AxlyLogo size="md" />
          <button
            onClick={handleClose}
            className="mobile-only"
            style={{
              marginLeft: 'auto', width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', background: 'var(--bg-glass)',
              border: '1px solid var(--border-color)', cursor: 'pointer',
            }}
            aria-label="Close Sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Items Grouped */}
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.title} style={{ marginBottom: 12 }}>
              <div className="nav-section-label" style={{ marginTop: gIdx > 0 ? 8 : 0 }}>
                {group.title}
              </div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={handleClose}
                  id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                >
                  {item.icon}
                  {item.label}
                  <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.35 }} />
                </NavLink>
              ))}
            </div>
          ))}

          {/* Role-Gated Admin Navigation: Only visible when server verified role === 'admin' */}
          {isAdmin && (
            <div style={{ marginBottom: 12 }}>
              <div className="nav-section-label" style={{ marginTop: 8 }}>Governance</div>
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={handleClose}
                id="nav-admin-operations"
                style={{ color: '#2563eb' }}
              >
                <ShieldAlert size={18} />
                <span>Admin Console</span>
                <span className="badge badge-admin" style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '1px 6px' }}>
                  ADMIN
                </span>
              </NavLink>
            </div>
          )}

          <div className="nav-section-label" style={{ marginTop: 8 }}>Preferences</div>

          {/* Theme Toggle */}
          <button className="nav-item" onClick={toggleTheme} id="theme-toggle-sidebar" style={{ width: '100%', textAlign: 'left' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </button>

          {/* Sign Out */}
          <button
            className="nav-item"
            onClick={handleLogout}
            id="logout-btn"
            style={{ color: 'var(--danger)', marginTop: 8, width: '100%', textAlign: 'left' }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </nav>

        {/* User Info Footer */}
        <div className="sidebar-footer">
          <div className="user-info" style={{ cursor: 'default' }}>
            <div className="user-avatar">{initials}</div>
            <div className="user-details" style={{ overflow: 'hidden' }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div className="user-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
            {isAdmin ? (
              <span className="badge badge-admin" style={{ fontSize: '0.62rem', padding: '2px 6px', flexShrink: 0 }}>
                ADMIN
              </span>
            ) : (
              <span className="badge" style={{ fontSize: '0.62rem', padding: '2px 6px', flexShrink: 0, background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                MEMBER
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
