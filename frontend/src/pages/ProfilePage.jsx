import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  UserRound, Mail, ShieldCheck, CalendarDays, Save, Settings2,
  CreditCard, ArrowUpRight, BadgeCheck, Camera, Upload, Trash2,
  Globe, Briefcase, Building2, Phone, MapPin, Copy, Check, Sparkles
} from 'lucide-react';
import { useAuth, api } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PRESET_AVATARS = [
  {
    name: 'Violet Glow',
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g1' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%237c3aed'/><stop offset='100%' stop-color='%23a855f7'/></linearGradient></defs><rect width='100' height='100' rx='28' fill='url(%23g1)'/><circle cx='50' cy='38' r='18' fill='white' opacity='0.95'/><path d='M22 84 C26 62, 74 62, 78 84' fill='white' opacity='0.95'/></svg>"
  },
  {
    name: 'Ocean Cyan',
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%230284c7'/><stop offset='100%' stop-color='%2338bdf8'/></linearGradient></defs><rect width='100' height='100' rx='28' fill='url(%23g2)'/><circle cx='50' cy='38' r='18' fill='white' opacity='0.95'/><path d='M22 84 C26 62, 74 62, 78 84' fill='white' opacity='0.95'/></svg>"
  },
  {
    name: 'Emerald Forest',
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g3' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23059669'/><stop offset='100%' stop-color='%2334d399'/></linearGradient></defs><rect width='100' height='100' rx='28' fill='url(%23g3)'/><circle cx='50' cy='38' r='18' fill='white' opacity='0.95'/><path d='M22 84 C26 62, 74 62, 78 84' fill='white' opacity='0.95'/></svg>"
  },
  {
    name: 'Sunset Amber',
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g4' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23ea580c'/><stop offset='100%' stop-color='%23fb923c'/></linearGradient></defs><rect width='100' height='100' rx='28' fill='url(%23g4)'/><circle cx='50' cy='38' r='18' fill='white' opacity='0.95'/><path d='M22 84 C26 62, 74 62, 78 84' fill='white' opacity='0.95'/></svg>"
  },
  {
    name: 'Midnight Slate',
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g5' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%230f172a'/><stop offset='100%' stop-color='%23334155'/></linearGradient></defs><rect width='100' height='100' rx='28' fill='url(%23g5)'/><circle cx='50' cy='38' r='18' fill='white' opacity='0.95'/><path d='M22 84 C26 62, 74 62, 78 84' fill='white' opacity='0.95'/></svg>"
  },
  {
    name: 'Royal Indigo',
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g6' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%234338ca'/><stop offset='100%' stop-color='%236366f1'/></linearGradient></defs><rect width='100' height='100' rx='28' fill='url(%23g6)'/><circle cx='50' cy='38' r='18' fill='white' opacity='0.95'/><path d='M22 84 C26 62, 74 62, 78 84' fill='white' opacity='0.95'/></svg>"
  }
];

const initialsFor = (name = '') => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('')
  .toUpperCase() || 'U';

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
};

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const fileInputRef = useRef(null);

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [company, setCompany] = useState(user?.company || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [location, setLocation] = useState(user?.location || '');

  const [memberSince, setMemberSince] = useState(user?.created_at || null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  useEffect(() => {
    let active = true;

    api.get('/auth/me')
      .then(({ data }) => {
        if (!active || !data?.user) return;
        const u = data.user;
        setName(u.name || '');
        setAvatarUrl(u.avatar_url || '');
        setJobTitle(u.job_title || '');
        setCompany(u.company || '');
        setBio(u.bio || '');
        setWebsite(u.website || '');
        setPhone(u.phone || '');
        setLocation(u.location || '');
        setMemberSince(u.created_at || null);
      })
      .catch(() => {
        // Fallback to active session
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => { active = false; };
  }, []);

  // Handle local image file upload and optimize with canvas
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setAvatarUrl(dataUrl);
        setAvatarModalOpen(false);
        toast.success('Profile picture selected! Click "Save changes" to apply.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = (e) => {
    e.preventDefault();
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      return;
    }
    setAvatarUrl(trimmed);
    setCustomUrlInput('');
    setAvatarModalOpen(false);
    toast.success('Profile picture URL set! Click "Save changes" to apply.');
  };

  const handleSelectPreset = (presetSrc) => {
    setAvatarUrl(presetSrc);
    setAvatarModalOpen(false);
    toast.success('Preset avatar selected! Click "Save changes" to apply.');
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    setAvatarModalOpen(false);
    toast.success('Picture removed. Initial badge will be displayed.');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      toast.error('Your display name must be between 2 and 80 characters.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({
        name: cleanName,
        avatar_url: avatarUrl || null,
        job_title: jobTitle.trim() || null,
        company: company.trim() || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
        phone: phone.trim() || null,
        location: location.trim() || null,
      });

      setName(updated.name || cleanName);
      setAvatarUrl(updated.avatar_url || '');
      toast.success('Profile and picture updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const copyUserId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    toast.success('User ID copied to clipboard!');
    setTimeout(() => setCopiedId(false), 2500);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="page-container profile-page">
      <div className="page-header profile-page-header">
        <div>
          <div className="profile-eyebrow">WORKSPACE IDENTITY</div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal information, profile photo, and digital presence.</p>
        </div>
        <Link to="/app/settings" className="btn btn-secondary profile-settings-link">
          <Settings2 size={16} /> Security Settings
        </Link>
      </div>

      <div className="profile-page-grid">
        <section className="card profile-main-card">
          {/* Header Avatar & Identity Card */}
          <div className="profile-person-header">
            <div style={{ position: 'relative' }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name || user?.name || 'Profile Avatar'}
                  className="profile-avatar-large"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className="profile-avatar-large">
                  {initialsFor(name || user?.name)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                title="Change profile picture"
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--brand-primary)',
                  color: '#ffffff',
                  border: '2px solid var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Camera size={15} />
              </button>
            </div>

            <div className="profile-person-copy">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2>{name || user?.name || 'Axly Member'}</h2>
                <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-active'} profile-role-badge`}>
                  {isAdmin ? <ShieldCheck size={13} /> : <BadgeCheck size={13} />}
                  {isAdmin ? 'Administrator' : 'Member'}
                </span>
              </div>
              <p>{user?.email || 'No email available'}</p>
              {jobTitle && company ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Briefcase size={13} />
                  <span>{jobTitle} at <strong>{company}</strong></span>
                </div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="profile-section-heading">
              <div className="profile-section-icon"><UserRound size={17} /></div>
              <div>
                <h3>Personal Information</h3>
                <p>Customize your identity across links, pages, and team workspaces.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {/* Display Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-display-name">Display Name *</label>
                <input
                  id="profile-display-name"
                  className="form-input"
                  type="text"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                />
                <small className="profile-field-hint">Your public identity in Axly Studio.</small>
              </div>

              {/* Email (Read-only) */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-email">Email Address</label>
                <div className="profile-input-with-icon" style={{ position: 'relative' }}>
                  <input
                    id="profile-email"
                    className="form-input"
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    aria-readonly="true"
                    style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed', paddingLeft: 38 }}
                  />
                  <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
                <small className="profile-field-hint">Primary login email (cannot be modified here).</small>
              </div>
            </div>

            {/* Professional Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 8 }}>
              {/* Job Title */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-job-title">Job Title / Role</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-job-title"
                    className="form-input"
                    type="text"
                    maxLength={100}
                    value={jobTitle}
                    onChange={e => setJobTitle(e.target.value)}
                    placeholder="e.g. Growth Specialist, Full Stack Engineer"
                    style={{ paddingLeft: 38 }}
                  />
                  <Briefcase size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Organization / Company */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-company">Company / Organization</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-company"
                    className="form-input"
                    type="text"
                    maxLength={100}
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="e.g. Axly Tech, Acme Corp"
                    style={{ paddingLeft: 38 }}
                  />
                  <Building2 size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>

            {/* Online Presence & Contact Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 8 }}>
              {/* Website */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-website">Website / Portfolio Link</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-website"
                    className="form-input"
                    type="url"
                    maxLength={255}
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="https://yourbrand.com"
                    style={{ paddingLeft: 38 }}
                  />
                  <Globe size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Location */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-location">Location / City</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-location"
                    className="form-input"
                    type="text"
                    maxLength={100}
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, India"
                    style={{ paddingLeft: 38 }}
                  />
                  <MapPin size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label" htmlFor="profile-phone">Phone Number</label>
              <div style={{ position: 'relative', maxWidth: 360 }}>
                <input
                  id="profile-phone"
                  className="form-input"
                  type="tel"
                  maxLength={50}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={{ paddingLeft: 38 }}
                />
                <Phone size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Bio / About */}
            <div className="form-group" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" htmlFor="profile-bio">Bio / About</label>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{bio.length} / 500</span>
              </div>
              <textarea
                id="profile-bio"
                className="form-input"
                rows={3}
                maxLength={500}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Share a short summary about yourself, projects, or background..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="profile-form-actions" style={{ marginTop: 24 }}>
              <button type="submit" className="btn btn-primary" disabled={saving || loadingProfile}>
                {saving ? (
                  <>Saving Changes...</>
                ) : (
                  <><Save size={16} /> Save Changes</>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Sidebar Overview Details */}
        <aside className="profile-sidebar-column" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Account Overview Card */}
          <div className="card profile-overview-card">
            <div className="profile-section-heading profile-overview-heading">
              <div className="profile-section-icon"><ShieldCheck size={17} /></div>
              <div>
                <h3>Account Overview</h3>
                <p>Your subscription &amp; platform access details.</p>
              </div>
            </div>

            <div className="profile-overview-list">
              <div className="profile-overview-item">
                <span className="profile-overview-icon"><CreditCard size={16} /></span>
                <div>
                  <span className="profile-overview-label">Plan Tier</span>
                  <strong>{user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free'}</strong>
                </div>
              </div>
              <div className="profile-overview-item">
                <span className="profile-overview-icon"><ShieldCheck size={16} /></span>
                <div>
                  <span className="profile-overview-label">Access Level</span>
                  <strong>{isAdmin ? 'Administrator' : 'Standard Member'}</strong>
                </div>
              </div>
              <div className="profile-overview-item">
                <span className="profile-overview-icon"><CalendarDays size={16} /></span>
                <div>
                  <span className="profile-overview-label">Member Since</span>
                  <strong>{loadingProfile ? 'Loading…' : formatDate(memberSince)}</strong>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 16 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Account Identifier</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 8 }}>
                <code style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.id || '—'}
                </code>
                <button
                  type="button"
                  onClick={copyUserId}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', height: 'auto', minHeight: 0 }}
                  title="Copy User ID"
                >
                  {copiedId ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            <Link to="/app/settings" className="profile-overview-link" style={{ marginTop: 18 }}>
              Privacy &amp; Security Settings <ArrowUpRight size={15} />
            </Link>
          </div>

          {/* Quick Guidance Card */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 750, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} style={{ color: 'var(--brand-primary)' }} />
              Public Pages vs Profile
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              Your <strong>Account Profile</strong> is private and controls your team identity. To build a shareable link-in-bio or portfolio page for external visitors, head to <Link to="/app/pages" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>My Pages</Link>.
            </p>
          </div>
        </aside>
      </div>

      {/* AVATAR SELECTOR MODAL */}
      {avatarModalOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setAvatarModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Choose Profile Picture</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAvatarModalOpen(false)}
                style={{ padding: 6, height: 32, width: 32, borderRadius: 8 }}
              >
                ✕
              </button>
            </div>

            {/* Current Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', marginBottom: 20 }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Preview" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-gradient)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem' }}>
                  {initialsFor(name || user?.name)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Current Avatar</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {avatarUrl ? 'Custom photo or preset loaded' : 'Using default initials badge'}
                </div>
              </div>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="btn btn-secondary btn-sm"
                  style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              )}
            </div>

            {/* Upload File Option */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                1. Upload from Computer
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px' }}
              >
                <Upload size={16} /> Choose Image File (PNG, JPG)
              </button>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Optimized automatically for high-resolution display.
              </div>
            </div>

            {/* Preset Avatars */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: 8 }}>
                2. Or Pick a Designed Preset
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {PRESET_AVATARS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p.src)}
                    title={p.name}
                    style={{
                      border: avatarUrl === p.src ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)',
                      background: 'none',
                      borderRadius: '50%',
                      padding: 2,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <img src={p.src} alt={p.name} style={{ width: '100%', height: 'auto', borderRadius: '50%', display: 'block' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Image URL */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: 6 }}>
                3. Or Enter an Image URL
              </div>
              <form onSubmit={handleApplyCustomUrl} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/avatar.jpg"
                  value={customUrlInput}
                  onChange={e => setCustomUrlInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                  Apply URL
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
