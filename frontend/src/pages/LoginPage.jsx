import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(form.email, form.password);
      toast.success('Welcome back! 🎉');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Bg orbs */}
      <div style={{
        position: 'absolute', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(124,58,237,0.15), transparent)',
        borderRadius: '50%', top: -200, right: -100, filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent)',
        borderRadius: '50%', bottom: -100, left: 200, filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* Left Panel - Branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.05) 100%)',
        borderRight: '1px solid var(--border-color)',
        position: 'relative', zIndex: 1,
      }} className="hide-mobile">
        <div style={{ maxWidth: 440 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div className="logo-icon" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>A</div>
            <span className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Axly</span>
          </Link>

          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
            Powerful link management<br />
            <span className="gradient-text">for everyone</span>
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7, marginBottom: 40 }}>
            Create, manage and track your short links with beautiful analytics dashboards.
          </p>

          {[
            { icon: '⚡', text: 'Lightning fast redirects' },
            { icon: '📊', text: 'Real-time click analytics' },
            { icon: '🎨', text: 'Custom branded aliases' },
            { icon: '📱', text: 'QR code generation' },
          ].map((item) => (
            <div key={item.text} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.95rem',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Form */}
      <div style={{
        width: '100%', maxWidth: 520,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '40px',
        position: 'relative', zIndex: 1,
      }}>
        {/* Mobile Logo */}
        <div style={{ marginBottom: 32, display: 'none' }} className="show-mobile">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-icon">A</div>
            <span className="gradient-text" style={{ fontSize: '1.3rem', fontWeight: 700 }}>Axly</span>
          </Link>
        </div>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 8 }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Sign in to your Axly account to continue
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email address</label>
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
                placeholder="you@example.com"
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
                placeholder="Your password"
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
            style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 18, height: 18 }} /> Signing in...</>
            ) : (
              <>Sign In <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div style={{
          textAlign: 'center', marginTop: 28,
          color: 'var(--text-secondary)', fontSize: '0.9rem',
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
            Create one free →
          </Link>
        </div>

        {/* Demo credentials hint */}
        <div style={{
          marginTop: 24,
          padding: '14px 18px',
          background: 'rgba(124, 58, 237, 0.06)',
          border: '1px solid rgba(124, 58, 237, 0.15)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Zap size={14} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Demo account:</strong>{' '}
            demo@axly.in / demo1234
          </span>
        </div>
      </div>
    </div>
  );
}
