import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useEffect, useRef } from 'react';

export default function AdminRoute() {
  const { user, loading } = useAuth();
  const deniedToastShown = useRef(false);

  useEffect(() => {
    if (!loading && user && user.role !== 'admin' && !deniedToastShown.current) {
      deniedToastShown.current = true;
      toast.error('Access denied. Administrator privileges required.');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px', borderWidth: 3 }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Verifying permissions...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}
