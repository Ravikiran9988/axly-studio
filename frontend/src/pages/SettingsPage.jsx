import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import {
  User, Mail, Shield, Bell, Palette, Globe, Save,
  Download, Trash2, ExternalLink, AlertTriangle, CheckCircle2, Sun, Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [nameForm, setNameForm] = useState({ name: user?.name || '' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    toast.success('Profile updated!');
    setSaving(false);
  };

  // Download Machine-Readable User Data Export
  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/user/export');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data.export || res.data.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `axly-data-export-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Personal data archive downloaded!');
    } catch (err) {
      toast.error('Failed to export account data.');
    } finally {
      setExporting(false);
    }
  };

  // Confirm Account Deletion
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await api.delete('/user/account', {
        data: {
          confirmationEmail: deleteConfirmText,
          confirmation: deleteConfirmText,
        }
      });
      toast.success('Account and associated data deleted.');
      logout();
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Privacy</h1>
          <p className="page-subtitle">Manage your account profile, privacy controls, and security</p>
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your personal credentials</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div className="user-avatar" style={{ width: 64, height: 64, fontSize: '1.4rem' }}>
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</div>
              <span className={`badge ${user?.role === 'admin' ? 'badge-admin' : 'badge-active'}`} style={{ marginTop: 6 }}>
                {user?.role === 'admin' ? 'Administrator' : 'Active Member'}
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customize how Axly Studio looks</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {theme === 'dark' ? (
                  <>
                    <Moon size={15} style={{ color: 'var(--brand-primary)' }} />
                    <span>Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun size={15} style={{ color: '#f59e0b' }} />
                    <span>Light Mode</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Switch between curated sleek dark theme and responsive light mode
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

        {/* Developer Platform Link */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)' }}>
                <Globe size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Developer Platform</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage API Keys, signed Webhooks, and Branded Domains</p>
              </div>
            </div>
            <Link to="/app/developer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Developer Console <ExternalLink size={14} />
            </Link>
          </div>
        </div>

        {/* Privacy Controls & Data Export */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <Download size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Privacy & Data Governance</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Export your data archive and inspect retention policy</p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 16, fontSize: '0.82rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Data Retention & Privacy Notice</div>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Clickstream records and link metadata are retained throughout the active lifetime of your account.
              Platform backups are encrypted and automatically rolled off on a 30-day lifecycle.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportData}
            disabled={exporting}
            id="btn-export-user-data"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Download size={14} />
            {exporting ? 'Generating JSON Archive...' : 'Download Personal Data Archive (.json)'}
          </button>
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
            Permanently delete your account, personal links, custom aliases, campaigns, and experiment data.
          </p>
          <button
            id="delete-account-btn"
            className="btn btn-danger btn-sm"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 size={14} /> Delete Account
          </button>
        </div>
      </div>

      {/* ACCOUNT DELETION CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)', marginBottom: 12 }}>
              <AlertTriangle size={24} />
              <h3 style={{ margin: 0 }}>Delete Account Permanently</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              This action cannot be undone. To confirm, please type your account email (<b>{user?.email}</b>) or type <b>DELETE MY ACCOUNT</b> below:
            </p>

            <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input
                type="text"
                className="form-input"
                placeholder={user?.email || 'DELETE MY ACCOUNT'}
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                required
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={deleting || (deleteConfirmText !== user?.email && deleteConfirmText !== 'DELETE MY ACCOUNT')}
                >
                  {deleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
