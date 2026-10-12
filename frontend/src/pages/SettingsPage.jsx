import { useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { User, Mail, Shield, Bell, Palette, Globe, Save } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [nameForm, setNameForm] = useState({ name: user?.name || '' });
  const [saving, setSaving] = useState(false);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    // In a full implementation this would call PATCH /api/auth/profile
    await new Promise(r => setTimeout(r, 800));
    toast.success('Profile updated!');
    setSaving(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>
        {/* Profile */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
              <User size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Profile</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your personal information</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div className="user-avatar" style={{ width: 64, height: 64, fontSize: '1.4rem' }}>
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</div>
              <span className={`badge ${user?.plan === 'pro' ? 'badge-pro' : 'badge-active'}`} style={{ marginTop: 6 }}>
                {user?.plan === 'pro' ? '⚡ Pro Plan' : '✓ Free Plan'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-name">Display Name</label>
              <input id="settings-name" type="text" className="form-input"
                value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-email">Email Address</label>
              <input id="settings-email" type="email" className="form-input"
                value={user?.email || ''} disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
            <div>
              <button id="save-profile" type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          </form>
        </div>

        {/* Appearance */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(236,72,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
              <Palette size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Appearance</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customize how Axly looks</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Switch between dark and light theme
              </div>
            </div>
            <button
              id="settings-theme-toggle"
              onClick={toggleTheme}
              style={{
                width: 52, height: 28,
                background: theme === 'dark' ? 'var(--brand-gradient)' : 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 14,
                position: 'relative', cursor: 'pointer', transition: 'all 0.25s ease',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: theme === 'dark' ? 26 : 2,
                transition: 'left 0.25s ease',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>
        </div>

        {/* API Info */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)' }}>
              <Globe size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>API Access</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Integrate Axly into your apps</p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border-color)', marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base URL</div>
            <code style={{ fontSize: '0.875rem', color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
              https://url.axly.in/api/v1
            </code>
          </div>

          {[
            { method: 'POST', path: '/urls', desc: 'Create a short URL' },
            { method: 'GET', path: '/urls', desc: 'List your URLs' },
            { method: 'GET', path: '/urls/:id/analytics', desc: 'Get click analytics' },
            { method: 'DELETE', path: '/urls/:id', desc: 'Delete a URL' },
          ].map(ep => (
            <div key={ep.path} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                padding: '2px 8px', borderRadius: 4,
                background: ep.method === 'POST' ? 'rgba(16,185,129,0.15)' : ep.method === 'GET' ? 'rgba(6,182,212,0.15)' : 'rgba(239,68,68,0.15)',
                color: ep.method === 'POST' ? 'var(--success)' : ep.method === 'GET' ? 'var(--info)' : 'var(--danger)',
                fontFamily: 'monospace',
              }}>
                {ep.method}
              </span>
              <code style={{ fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1 }}>{ep.path}</code>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ep.desc}</span>
            </div>
          ))}

          <div className="alert alert-info" style={{ marginTop: 16, fontSize: '0.82rem' }}>
            💡 API keys and OAuth coming soon. Currently uses your JWT session token.
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--danger)' }}>Danger Zone</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Irreversible actions</p>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 16 }}>
            Deleting your account will permanently remove all your links, analytics data, and custom aliases.
          </p>
          <button
            id="delete-account-btn"
            className="btn btn-danger btn-sm"
            onClick={() => toast.error('Account deletion not implemented in demo')}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
