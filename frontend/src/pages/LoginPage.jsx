import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap, ShieldCheck, Database, AlertCircle } from 'lucide-react';
import AxlyLogo from '../components/AxlyLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated, redirect immediately based on role
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
    setLoading(true);
    setError('');

    try {
      const res = await login(form.email, form.password);
      toast.success(`Welcome back, ${res.user?.name || 'user'}!`);
      
      // Role-based routing: Verified by backend JWT and DB
      if (res.user?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle Background Accents */}
      <div style={{
        position: 'absolute', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(37,99,235,0.06), transparent 70%)',
        borderRadius: '50%', top: -200, right: -100, filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />

      {/* Left Panel - Axly Studio Branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border-color)',
        position: 'relative', zIndex: 1,
      }} className="hide-mobile">
        <div style={{ maxWidth: 460 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 44, textDecoration: 'none' }}>
            <AxlyLogo size="lg" />
          </Link>

          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: 16, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            Sign in to manage and scale your links with confidence.
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1.02rem', lineHeight: 1.65, marginBottom: 36 }}>
            Unified access portal for link operations, automated analytics, and system governance.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: <Zap size={16} />, iconColor: 'var(--warning)', title: 'Lakebase Postgres Engine', desc: 'Real-time click streams with pooled high-throughput latency' },
              { icon: <ShieldCheck size={16} />, iconColor: 'var(--brand-primary)', title: 'Role-Based Access Control', desc: 'Isolated personal workspaces and comprehensive administrator oversight' },
              { icon: <Lock size={16} />, iconColor: 'var(--success)', title: 'Zero Public Admin Vector', desc: 'Secure backend credential verification with no public entrypoints' },
            ].map((item) => (
              <div key={item.title} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              }}>
                <span style={{ marginTop: 3, color: item.iconColor }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Shared Sign-In Form */}
      <div className="auth-form-panel" style={{
        width: '100%', maxWidth: 520,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px 40px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Mobile Header */}
        <div style={{ marginBottom: 32 }} className="show-mobile">
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <AxlyLogo size="md" />
          </Link>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
            Sign In
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Enter your credentials to access your dashboard.
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
              }} />
              <input
                id="login-email"
                name="email"
                type="email"
                className="form-input"
                style={{ paddingLeft: 42 }}
                placeholder="operator@company.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
              }} />
              <input
                id="login-password"
                name="password"
                type={showPw ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: 42, paddingRight: 42 }}
                placeholder="Enter account password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                style={{
                  position: 'absolute', right: 14, top: '50%',
                  transform: 'translateY(-50%)', color: 'var(--text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '13px', marginTop: 4 }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18 }} /> Signing in...</>
            ) : (
              <>Sign In to Studio <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div style={{
          textAlign: 'center', marginTop: 26,
          color: 'var(--text-secondary)', fontSize: '0.9rem',
        }}>
          New to Axly Studio?{' '}
          <Link to="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
            Create an account →
          </Link>
        </div>

      </div>
    </div>
  );
}
