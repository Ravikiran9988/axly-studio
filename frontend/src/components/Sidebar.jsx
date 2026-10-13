import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Link2, Settings, LogOut,
  Moon, Sun, Menu, X, ChevronRight, ShieldAlert,
  Megaphone, GitCompare, FileSpreadsheet, BarChart3,
  Users, Code2, UserRound, PanelsTopLeft, Globe, QrCode,
  HelpCircle, Plus, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import AxlyLogo from './AxlyLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { to: '/app/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    ]
  },
  {
    title: 'Create',
    items: [
      { isAction: true, actionType: 'create-link', icon: <Plus size={18} />, label: 'Shorten a Link' },
      { to: '/app/qr', icon: <QrCode size={18} />, label: 'QR Code Generator' },
      { to: '/app/pages', icon: <PanelsTopLeft size={18} />, label: 'My Pages' },
    ]
  },
  {
    title: 'Manage',
    items: [
      { to: '/app/links', icon: <Link2 size={18} />, label: 'My Links' },
      { to: '/app/domains', icon: <Globe size={18} />, label: 'Custom Domains' },
      { to: '/app/campaigns', icon: <Megaphone size={18} />, label: 'Campaigns & UTM' },
      { to: '/app/experiments', icon: <GitCompare size={18} />, label: 'A/B Experiments' },
    ]
  },
  {
    title: 'Insights',
    items: [
      { to: '/app/analytics', icon: <BarChart3 size={18} />, label: 'Link Analytics' },
    ]
  },
  {
    title: 'Workspace',
    items: [
      { to: '/app/teams', icon: <Users size={18} />, label: 'Teams & Workspaces' },
      { to: '/app/developer', icon: <Code2 size={18} />, label: 'Developer Tools' },
      { to: '/app/bulk', icon: <FileSpreadsheet size={18} />, label: 'Bulk Import/Export' },
    ]
  },
  {
    title: 'Account',
    items: [
      { to: '/app/profile', icon: <UserRound size={18} />, label: 'My Profile' },
      { to: '/app/settings', icon: <Settings size={18} />, label: 'Settings' },
      { to: '/app/help', icon: <HelpCircle size={18} />, label: 'Help & Guides' },
    ]
  }
];

export default function Sidebar({ isOpen, onClose, onOpenCreateLink, isCollapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
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

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Studio Branding */}
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? '20px 10px' : '20px 16px' }}>
          <NavLink to="/app/dashboard" onClick={handleClose} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            {isCollapsed ? <AxlyLogo size="sm" variant="icon" /> : <AxlyLogo size="md" />}
          </NavLink>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Desktop Collapse Toggle */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="desktop-only"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
            )}

            {/* Mobile Close Button */}
            <button
              onClick={handleClose}
              className="mobile-only"
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', background: 'var(--bg-glass)',
                border: '1px solid var(--border-color)', cursor: 'pointer',
              }}
              aria-label="Close Sidebar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Items Grouped */}
        <nav className="sidebar-nav" style={{ padding: isCollapsed ? '12px 6px' : '16px 12px' }}>
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.title} style={{ marginBottom: isCollapsed ? 6 : 10 }}>
              {!isCollapsed && (
                <div className="nav-section-label" style={{ marginTop: gIdx > 0 ? 6 : 0, padding: '8px 8px 4px' }}>
                  {group.title}
                </div>
              )}
              {group.items.map(item => {
                if (item.isAction) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="nav-item"
                      onClick={() => {
                        handleClose();
                        if (onOpenCreateLink) onOpenCreateLink();
                      }}
                      title={item.label}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        color: 'var(--brand-primary)',
                        fontWeight: 600,
                      }}
                      id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    >
                      {item.icon}
                      {!isCollapsed && <span>{item.label}</span>}
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={handleClose}
                    title={item.label}
                    style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}
                    id={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  >
                    {item.icon}
                    {!isCollapsed && (
                      <>
                        <span>{item.label}</span>
                        <ChevronRight size={13} style={{ marginLeft: 'auto', opacity: 0.35 }} />
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}

          {/* Role-Gated Admin Navigation: Strictly visible only when role === 'admin' */}
          {isAdmin && (
            <div style={{ marginBottom: 10 }}>
              {!isCollapsed && <div className="nav-section-label" style={{ marginTop: 6, padding: '8px 8px 4px' }}>Governance</div>}
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={handleClose}
                id="nav-admin-operations"
                title="Admin Console"
                style={{ color: '#2563eb', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
              >
                <ShieldAlert size={18} />
                {!isCollapsed && (
                  <>
                    <span>Admin Console</span>
                    <span className="badge badge-admin" style={{ marginLeft: 'auto', fontSize: '0.62rem', padding: '1px 5px' }}>
                      ADMIN
                    </span>
                  </>
                )}
              </NavLink>
            </div>
          )}

          {!isCollapsed && <div className="nav-section-label" style={{ marginTop: 6, padding: '8px 8px 4px' }}>Preferences</div>}

          {/* Theme Toggle */}
          <button 
            className="nav-item" 
            onClick={toggleTheme} 
            id="theme-toggle-sidebar" 
            title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            style={{ width: '100%', textAlign: 'left', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {!isCollapsed && <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>}
          </button>

          {/* Sign Out */}
          <button
            className="nav-item"
            onClick={handleLogout}
            id="logout-btn"
            title="Sign Out"
            style={{ color: 'var(--danger)', marginTop: 6, width: '100%', textAlign: 'left', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
          >
            <LogOut size={18} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </nav>

        {/* User Info Footer */}
        <div className="sidebar-footer" style={{ padding: isCollapsed ? '12px 6px' : '14px 16px' }}>
          <div className="user-info" style={{ cursor: 'default', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
            <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>{initials}</div>
            {!isCollapsed && (
              <>
                <div className="user-details" style={{ overflow: 'hidden' }}>
                  <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {user?.name}
                  </div>
                  <div className="user-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                    {user?.email}
                  </div>
                </div>
                {isAdmin ? (
                  <span className="badge badge-admin" style={{ fontSize: '0.6rem', padding: '1px 5px', flexShrink: 0 }}>
                    ADMIN
                  </span>
                ) : (
                  <span className="badge" style={{ fontSize: '0.6rem', padding: '1px 5px', flexShrink: 0, background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    MEMBER
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
