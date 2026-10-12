import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 16px',
            background: 'var(--brand-gradient)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900,
            color: '#fff', fontFamily: 'var(--font-display)',
            boxShadow: '0 0 30px rgba(124,58,237,0.4)',
            animation: 'pulse 1.5s ease infinite',
          }}>A</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</div>
        </div>
        <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.95);opacity:0.8} }`}</style>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
