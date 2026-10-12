import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PERKS = [
  'Unlimited short links',
  'Click analytics & tracking',
  'Custom aliases',
  'QR code generation',
  'Link expiration',
  'Team collaboration (soon)',
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created! Welcome to Axly 🎉');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = (() => {
    const pw = form.password;
    if (!pw) return null;
    if (pw.length < 6) return { label: 'Too short', color: 'var(--danger)', width: '20%' };
    if (pw.length < 8) return { label: 'Weak', color: 'var(--warning)', width: '40%' };
    if (pw.match(/[A-Z]/) && pw.match(/[0-9]/)) return { label: 'Strong', color: 'var(--success)', width: '100%' };
    return { label: 'Medium', color: 'var(--info)', width: '70%' };
  })();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Bg */}
      <div style={{
        position: 'absolute', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(79,70,229,0.12), transparent)',
        borderRadius: '50%', bottom: -200, left: -200, filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />

      {/* Form Panel */}
      <div style={{
        width: '100%', maxWidth: 520,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '40px',
        position: 'relative', zIndex: 1,
        borderRight: '1px solid var(--border-color)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div className="logo-icon">A</div>
          <span className="gradient-text" style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Axly</span>
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8 }}>Create your account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Free forever. No credit card required.
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>⚠️ {error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="reg-name" name="name" type="text" className="form-input" style={{ paddingLeft: 42 }}
                placeholder="John Doe" value={form.name} onChange={handleChange} required autoComplete="name" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="reg-email" name="email" type="email" className="form-input" style={{ paddingLeft: 42 }}
                placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="reg-password" name="password" type={showPw ? 'text' : 'password'} className="form-input"
                style={{ paddingLeft: 42, paddingRight: 42 }}
                placeholder="Min. 6 characters" value={form.password} onChange={handleChange} required autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer',
              }}>
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

          <button id="register-submit" type="submit" className="btn btn-primary" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: 4 }}>
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18 }} /> Creating account...</>
            ) : (
              <>Create Free Account <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Sign in →</Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      {/* Right Panel - Perks */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(6,182,212,0.04) 100%)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 'var(--radius-full)', padding: '8px 16px',
            fontSize: '0.82rem', fontWeight: 600, color: 'var(--brand-primary)',
            marginBottom: 28,
          }}>
            ✨ Free plan includes
          </div>

          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 12, lineHeight: 1.2 }}>
            Start building your<br />
            <span className="gradient-text">link empire today</span>
          </h2>

          <p style={{ color: 'var(--text-secondary)', marginBottom: 36, fontSize: '0.95rem', lineHeight: 1.7 }}>
            Everything you need to create, manage, and track powerful short links.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PERKS.map((perk) => (
              <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--success-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Check size={13} color="var(--success)" />
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{perk}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{
            marginTop: 48, padding: '20px 24px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 16 }}>
              "Axly transformed how I share content. The analytics are incredible — I finally understand my audience."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>RK</div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Rahul Kumar</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Content Creator</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
