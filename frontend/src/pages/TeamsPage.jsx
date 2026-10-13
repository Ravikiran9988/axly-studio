import { useState, useEffect } from 'react';
import { api, useAuth } from '../context/AuthContext';
import {
  Users, UserPlus, Shield, Crown, Edit3, Trash2, Copy,
  Check, ArrowRightLeft, Building2, Plus, Mail, CheckCircle2
} from 'lucide-react';
import FeatureHelp from '../components/FeatureHelp';
import toast from 'react-hot-toast';

export default function TeamsPage() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [workspaceDetails, setWorkspaceDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createWsModal, setCreateWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'editor' });
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [transferModal, setTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');

  const [copied, setCopied] = useState(false);

  // Load Workspaces
  const loadWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      const wsList = res.data.data || [];
      setWorkspaces(wsList);
      if (wsList.length > 0 && !activeWorkspace) {
        // Default to first collaborative team workspace if exists, else first
        const teamWs = wsList.find(w => !w.is_personal) || wsList[0];
        setActiveWorkspace(teamWs);
      }
    } catch (err) {
      toast.error('Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  };

  // Load Active Workspace Details (Members & Invites)
  const loadWorkspaceDetails = async (wsId) => {
    if (!wsId) return;
    try {
      const res = await api.get(`/workspaces/${wsId}`);
      setWorkspaceDetails(res.data.data);
    } catch (err) {
      toast.error('Failed to load workspace members.');
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (activeWorkspace) {
      loadWorkspaceDetails(activeWorkspace.id);
    }
  }, [activeWorkspace]);

  // Create Workspace
  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/workspaces', { name: newWsName });
      toast.success('Team workspace created!');
      setCreateWsModal(false);
      setNewWsName('');
      const created = res.data.workspace || res.data.data;
      await loadWorkspaces();
      setActiveWorkspace(created);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create workspace.');
    }
  };

  // Invite Member
  const handleInviteMember = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/workspaces/${activeWorkspace.id}/invites`, inviteForm);
      const inv = res.data.invitation || res.data.data;
      setGeneratedInvite(inv);
      toast.success('Invitation generated!');
      loadWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invitation.');
    }
  };

  // Update Member Role
  const handleUpdateRole = async (memberUserId, newRole) => {
    try {
      await api.patch(`/workspaces/${activeWorkspace.id}/members/${memberUserId}`, { role: newRole });
      toast.success('Member role updated.');
      loadWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    }
  };

  // Remove Member
  const handleRemoveMember = async (memberUserId, memberName) => {
    if (!confirm(`Remove ${memberName} from this workspace?`)) return;
    try {
      await api.delete(`/workspaces/${activeWorkspace.id}/members/${memberUserId}`);
      toast.success('Member removed.');
      loadWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member.');
    }
  };

  // Transfer Ownership
  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!transferTargetId) return;
    if (!confirm('Are you sure you want to transfer ownership? You will become an Admin.')) return;
    try {
      await api.post(`/workspaces/${activeWorkspace.id}/transfer-ownership`, { newOwnerId: transferTargetId });
      toast.success('Workspace ownership transferred.');
      setTransferModal(false);
      loadWorkspaces();
      loadWorkspaceDetails(activeWorkspace.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed.');
    }
  };

  // Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (!confirm(`Permanently delete team workspace "${activeWorkspace.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/workspaces/${activeWorkspace.id}`);
      toast.success('Workspace deleted.');
      setActiveWorkspace(null);
      loadWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete workspace.');
    }
  };

  const currentRole = activeWorkspace?.role || 'viewer';
  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin' || isOwner;

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">Teams &amp; Workspaces</h1>
            <FeatureHelp featureKey="teams" title="Teams & Workspaces" />
          </div>
          <p className="page-subtitle">Collaborate with teammates using role-based access control (RBAC)</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreateWsModal(true)}>
          <Plus size={16} /> New Workspace
        </button>
      </div>

      {/* Workspace Switcher Bar */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12, marginBottom: 20 }}>
        {workspaces.map(ws => (
          <button
            key={ws.id}
            onClick={() => setActiveWorkspace(ws)}
            className={`btn btn-sm ${activeWorkspace?.id === ws.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <Building2 size={14} />
            {ws.name}
            {ws.is_personal && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>(Personal)</span>}
          </button>
        ))}
      </div>

      {activeWorkspace && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Workspace Info Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{activeWorkspace.name}</h3>
                <span className="badge badge-active" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  {currentRole}
                </span>
                {activeWorkspace.is_personal && (
                  <span className="badge" style={{ fontSize: '0.7rem' }}>Personal</span>
                )}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Slug: <code>{activeWorkspace.slug}</code>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {isAdmin && !activeWorkspace.is_personal && (
                <button className="btn btn-primary btn-sm" onClick={() => { setGeneratedInvite(null); setInviteModal(true); }}>
                  <UserPlus size={14} /> Invite Teammate
                </button>
              )}
              {isOwner && !activeWorkspace.is_personal && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => setTransferModal(true)}>
                    <ArrowRightLeft size={14} /> Transfer
                  </button>
                  <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={handleDeleteWorkspace}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Members Table */}
          <div className="card admin-table-container" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
              Team Members ({workspaceDetails?.members?.length || 0})
            </div>

            <table style={{ width: '100%', minWidth: 580, borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Member</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(workspaceDetails?.members || []).map(m => {
                  const isCurrentMemberOwner = m.role === 'owner';
                  return (
                    <tr key={m.user_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                            {m.name ? m.name.slice(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div>{m.name} {m.user_id === user?.id && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(You)</span>}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                        {m.email}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {isAdmin && !isCurrentMemberOwner && m.user_id !== user?.id ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleUpdateRole(m.user_id, e.target.value)}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 6,
                              padding: '4px 8px',
                              fontSize: '0.8rem',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`badge ${isCurrentMemberOwner ? 'badge-pro' : 'badge-active'}`} style={{ textTransform: 'capitalize' }}>
                            {m.role}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {isAdmin && !isCurrentMemberOwner && m.user_id !== user?.id && (
                          <button
                            className="btn btn-sm"
                            style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => handleRemoveMember(m.user_id, m.name)}
                            title="Remove Member"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pending Invitations Table */}
          {isAdmin && workspaceDetails?.pendingInvites?.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
                Pending Invitations ({workspaceDetails.pendingInvites.length})
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Invited Email</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Role</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Expires</th>
                    <th style={{ padding: '12px 20px', fontWeight: 600 }}>Invited By</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaceDetails.pendingInvites.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                          {inv.email}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className="badge" style={{ textTransform: 'capitalize' }}>{inv.role}</span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                        {inv.inviter_name || 'Admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE WORKSPACE MODAL */}
      {createWsModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <h3 style={{ marginBottom: 16 }}>Create Collaborative Team Workspace</h3>
            <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Workspace Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Marketing Team"
                  value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateWsModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Workspace</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVITE MEMBER MODAL */}
      {inviteModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: 16 }}>Invite Teammate to {activeWorkspace?.name}</h3>
            
            {generatedInvite ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 600 }}>
                  <CheckCircle2 size={18} /> Single-Use Invite Token Generated!
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Share this invitation link with <b>{generatedInvite.email}</b>. Token expires in 7 days.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <code style={{ fontSize: '0.85rem', color: 'var(--brand-primary)', flex: 1, wordBreak: 'break-all' }}>
                    {window.location.origin}{generatedInvite.shareableLink || generatedInvite.inviteLink}
                  </code>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${generatedInvite.shareableLink || generatedInvite.inviteLink}`);
                      setCopied(true);
                      toast.success('Invite link copied!');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />} Copy
                  </button>
                </div>
                <button className="btn btn-primary" onClick={() => setInviteModal(false)}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInviteMember} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Teammate Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="colleague@company.com"
                    value={inviteForm.email}
                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Access Role</label>
                  <select
                    className="form-input"
                    value={inviteForm.role}
                    onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                  >
                    <option value="editor">Editor — Can shorten links & manage campaigns</option>
                    <option value="viewer">Viewer — Read-only access to links and analytics</option>
                    <option value="admin">Admin — Can manage members, webhooks, and domains</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setInviteModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Generate Invitation</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TRANSFER OWNERSHIP MODAL */}
      {transferModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <h3 style={{ marginBottom: 12 }}>Transfer Workspace Ownership</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Select a member to become the new owner of <b>{activeWorkspace.name}</b>. You will retain Admin permissions.
            </p>
            <form onSubmit={handleTransferOwnership} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">New Owner</label>
                <select
                  className="form-input"
                  value={transferTargetId}
                  onChange={e => setTransferTargetId(e.target.value)}
                  required
                >
                  <option value="">Select a team member...</option>
                  {(workspaceDetails?.members || [])
                    .filter(m => m.user_id !== user?.id)
                    .map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTransferModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">Confirm Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
