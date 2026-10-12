import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Link2, BarChart3, Settings, LogOut,
  Moon, Sun, Menu, X, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/links', icon: <Link2 size={18} />, label: 'My Links' },
  { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <>
      {/* Mobile Toggle */}
      <button
        id="sidebar-toggle"
        onClick={() => setMobileOpen(p => !p)}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 200,
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          display: 'none', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-primary)', cursor: 'pointer',
        }}
        className="mobile-only"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99, backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">A</div>
          <div>
            <div className="logo-text">Axly</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: -2 }}>url.axly.in</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
              id={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              {item.icon}
              {item.label}
              <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
            </NavLink>
          ))}

          <div className="nav-section-label" style={{ marginTop: 8 }}>Account</div>

          {/* Theme Toggle */}
          <button className="nav-item" onClick={toggleTheme} id="theme-toggle-sidebar">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* Logout */}
          <button
            className="nav-item"
            onClick={handleLogout}
            id="logout-btn"
            style={{ color: 'var(--danger)', marginTop: 'auto' }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </nav>

        {/* User Info */}
        <div className="sidebar-footer">
          <div
            className="user-info"
            style={{ cursor: 'default' }}
          >
            <div className="user-avatar">{initials}</div>
            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            {user?.plan === 'pro' && (
              <span className="badge badge-pro" style={{ fontSize: '0.65rem', padding: '2px 7px' }}>PRO</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
