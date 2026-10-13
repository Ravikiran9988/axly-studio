import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PERKS = [
  'Unlimited short links & vanity slugs',
  'Real-time geographic & device analytics',
  'High-resolution vector & PNG QR codes',
  'Automated link expiration rules',
  'Exportable audit reports',
];

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long for account security.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created! Welcome to Axly Studio.');
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = (() => {
    const pw = form.password;
    if (!pw) return null;
    if (pw.length < 8) return { label: 'Too short (min 8)', color: 'var(--danger)', width: '25%' };
    if (pw.match(/[A-Z]/) && pw.match(/[0-9]/) && pw.length >= 10) return { label: 'Strong', color: 'var(--success)', width: '100%' };
    if (pw.match(/[A-Z]/) || pw.match(/[0-9]/)) return { label: 'Good', color: 'var(--brand-primary)', width: '70%' };
    return { label: 'Acceptable', color: 'var(--warning)', width: '45%' };
  })();

  return (
    <div className="auth-container" style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background Accent */}
      <div style={{
        position: 'absolute', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(37,99,235,0.05), transparent 70%)',
        borderRadius: '50%', bottom: -200, left: -200, filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />

      {/* Form Panel */}
      <div className="auth-form-panel" style={{
        width: '100%', maxWidth: 520,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px 40px',
        position: 'relative', zIndex: 1,
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, textDecoration: 'none' }}>
          <div className="logo-icon" style={{ width: 36, height: 36 }}>A</div>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Axly Studio
          </span>
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
            Create Studio Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Start shortening, tracking, and scaling your links in seconds.
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="reg-name"
                name="name"
                type="text"
                className="form-input"
                style={{ paddingLeft: 42 }}
                placeholder="Alex Morgan"
                value={form.name}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Work or Personal Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="reg-email"
                name="email"
                type="email"
                className="form-input"
                style={{ paddingLeft: 42 }}
                placeholder="alex@company.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password (Minimum 8 Characters)</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="reg-password"
                name="password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: 42, paddingRight: 42 }}
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer',
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pwStrength && (
              <div style={{ marginTop: 8 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: pwStrength.width, background: pwStrength.color }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: pwStrength.color, marginTop: 4, fontWeight: 500 }}>
                  {pwStrength.label}
                </div>
              </div>
            )}
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: 4 }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18 }} /> Creating account...</>
            ) : (
              <>Get Started Free <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Sign in →</Link>
        </p>

        <div style={{
          marginTop: 20,
          padding: '12px 14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <ShieldCheck size={18} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <span>New accounts are assigned standard member privileges. Administrative access requires CLI bootstrap.</span>
        </div>
      </div>

      {/* Right Panel - Axly Studio Features */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        background: 'var(--bg-primary)',
        position: 'relative', zIndex: 1,
      }} className="hide-mobile">
        <div style={{ maxWidth: 440 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-full)', padding: '6px 14px',
            fontSize: '0.82rem', fontWeight: 600, color: '#1d4ed8',
            marginBottom: 24,
          }}>
            Member Capabilities Included
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 12, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            Transform ordinary links into actionable intelligence.
          </h2>

          <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: '0.98rem', lineHeight: 1.65 }}>
            Upgrade from guest shortening to unlocked vanity slugs, historical dashboards, and custom QR codes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PERKS.map((perk) => (
              <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--success-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Check size={12} color="var(--success)" />
                </div>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 500 }}>{perk}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 40, padding: '20px 24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.65, marginBottom: 14 }}>
              "Axly Studio gives us absolute clarity over our campaign traffic without bloated tracking scripts or downtime."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', background: '#2563eb', color: '#fff' }}>AS</div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Engineering Lead</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High-Growth SaaS</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
