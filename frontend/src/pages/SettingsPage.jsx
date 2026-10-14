import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import {
  User, Mail, Shield, Bell, Globe, Save,
  Download, Trash2, ExternalLink, AlertTriangle, CheckCircle2,
  Bot, Copy, Check, Send
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [nameForm, setNameForm] = useState({ name: user?.name || '' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Telegram integration state
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [loadingTelegram, setLoadingTelegram] = useState(true);
  const [generatingTelegramCode, setGeneratingTelegramCode] = useState(false);
  const [telegramLinkData, setTelegramLinkData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    fetchTelegramStatus();
  }, []);

  const fetchTelegramStatus = async () => {
    try {
      const res = await api.get('/telegram/status');
      setTelegramStatus(res.data);
    } catch (err) {
      // Non-blocking
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleGenerateTelegramCode = async () => {
    setGeneratingTelegramCode(true);
    try {
      const res = await api.post('/telegram/link-code');
      setTelegramLinkData(res.data);
      toast.success('Linking code generated! It will expire in 10 minutes.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate linking code.');
    } finally {
      setGeneratingTelegramCode(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm('Are you sure you want to unlink your Telegram account? You will need a new code to reconnect.')) return;
    try {
      await api.post('/telegram/unlink');
      toast.success('Telegram bot unlinked successfully.');
      setTelegramStatus({ linked: false });
      setTelegramLinkData(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlink Telegram.');
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Linking code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: nameForm.name });
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
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

        {/* Telegram Bot Integration */}
        <div className="card" style={{ border: '1px solid rgba(124,58,237,0.25)', background: 'linear-gradient(180deg, rgba(124,58,237,0.03) 0%, rgba(124,58,237,0) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, minWidth: 36, borderRadius: 8, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                <Bot size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Axly Studio Telegram Bot</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Shorten links, generate QR codes, and manage your account in Telegram</p>
              </div>
            </div>
            {telegramStatus?.linked && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '0.78rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Connected
              </span>
            )}
          </div>

          {telegramStatus?.linked ? (
            <div>
              <div style={{ background: 'var(--bg-input)', padding: 14, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 16 }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                  Linked to <b>@{telegramStatus.telegram?.username || 'Telegram User'}</b> {telegramStatus.telegram?.firstName ? `(${telegramStatus.telegram.firstName})` : ''}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Connected on {new Date(telegramStatus.telegram?.linkedAt || Date.now()).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <a
                  href="https://t.me/AxlyStudioBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={14} /> Open Bot Chat
                </a>
                <button
                  type="button"
                  onClick={handleUnlinkTelegram}
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  Unlink Account
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Connect your Telegram account to access your private links, track click analytics, and create short links with 1-click inside Telegram.
              </p>

              {telegramLinkData ? (
                <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Your 10-minute single-use linking code:</div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                    <code style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.1em', padding: '6px 14px', background: 'rgba(124,58,237,0.1)', color: 'var(--brand-primary)', borderRadius: 6, wordBreak: 'break-all' }}>
                      {telegramLinkData.code}
                    </code>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyCode(telegramLinkData.code)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                      {copiedCode ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                    Click below to open the bot directly with your linking code:
                  </div>
                  <a
                    href={telegramLinkData.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}
                  >
                    <Send size={14} /> Connect in Telegram (1-Click)
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleGenerateTelegramCode}
                  disabled={generatingTelegramCode}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={14} />
                  {generatingTelegramCode ? 'Generating Code...' : 'Connect Telegram Bot'}
                </button>
              )}
            </div>
          )}
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
