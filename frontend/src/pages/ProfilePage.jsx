import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserRound, Mail, ShieldCheck, CalendarDays, Save, Settings2,
  CreditCard, ArrowUpRight, BadgeCheck
} from 'lucide-react';
import { useAuth, api } from '../context/AuthContext';
import toast from 'react-hot-toast';

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
  const [name, setName] = useState(user?.name || '');
  const [memberSince, setMemberSince] = useState(user?.created_at || null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    api.get('/auth/me')
      .then(({ data }) => {
        if (!active || !data?.user) return;
        setName(data.user.name || '');
        setMemberSince(data.user.created_at || null);
      })
      .catch(() => {
        // The current session can still edit its name if profile metadata is unavailable.
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => { active = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();

    if (cleanName.length < 2 || cleanName.length > 80) {
      toast.error('Your display name must be between 2 and 80 characters.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({ name: cleanName });
      setName(updated.name || cleanName);
      toast.success('Profile updated successfully.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="page-container profile-page">
      <div className="page-header profile-page-header">
        <div>
          <div className="profile-eyebrow">YOUR ACCOUNT</div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your personal information and account details.</p>
        </div>
        <Link to="/app/settings" className="btn btn-secondary profile-settings-link">
          <Settings2 size={16} /> Settings
        </Link>
      </div>

      <div className="profile-page-grid">
        <section className="card profile-main-card">
          <div className="profile-person-header">
            <div className="profile-avatar-large">{initialsFor(user?.name)}</div>
            <div className="profile-person-copy">
              <h2>{user?.name || 'Axly member'}</h2>
              <p>{user?.email || 'No email available'}</p>
              <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-active'} profile-role-badge`}>
                {isAdmin ? <ShieldCheck size={13} /> : <BadgeCheck size={13} />}
                {isAdmin ? 'Administrator' : 'Member'}
              </span>
            </div>
          </div>

          <div className="profile-section-heading">
            <div className="profile-section-icon"><UserRound size={17} /></div>
            <div>
              <h3>Personal information</h3>
              <p>Keep the name associated with your Axly account up to date.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group">
              <label className="form-label" htmlFor="profile-display-name">Display name</label>
              <input
                id="profile-display-name"
                className="form-input"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                value={name}
                onChange={event => setName(event.target.value)}
                required
              />
              <small className="profile-field-hint">This name appears in your Axly workspace.</small>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-email">Email address</label>
              <div className="profile-input-with-icon">
                <Mail size={17} />
                <input
                  id="profile-email"
                  className="form-input"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <small className="profile-field-hint">Your email is used for sign-in and cannot be changed here.</small>
            </div>

            <div className="profile-form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving || loadingProfile}>
                {saving
                  ? <><span className="spinner profile-save-spinner" /> Saving...</>
                  : <><Save size={16} /> Save changes</>}
              </button>
            </div>
          </form>
        </section>

        <aside className="card profile-overview-card">
          <div className="profile-section-heading profile-overview-heading">
            <div className="profile-section-icon"><ShieldCheck size={17} /></div>
            <div>
              <h3>Account overview</h3>
              <p>Your current Axly account details.</p>
            </div>
          </div>

          <div className="profile-overview-list">
            <div className="profile-overview-item">
              <span className="profile-overview-icon"><CreditCard size={16} /></span>
              <div>
                <span className="profile-overview-label">Plan</span>
                <strong>{user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free'}</strong>
              </div>
            </div>
            <div className="profile-overview-item">
              <span className="profile-overview-icon"><ShieldCheck size={16} /></span>
              <div>
                <span className="profile-overview-label">Access level</span>
                <strong>{isAdmin ? 'Administrator' : 'Standard member'}</strong>
              </div>
            </div>
            <div className="profile-overview-item">
              <span className="profile-overview-icon"><CalendarDays size={16} /></span>
              <div>
                <span className="profile-overview-label">Member since</span>
                <strong>{loadingProfile ? 'Loading…' : formatDate(memberSince)}</strong>
              </div>
            </div>
          </div>

          <Link to="/app/settings" className="profile-overview-link">
            Privacy and account settings <ArrowUpRight size={15} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
