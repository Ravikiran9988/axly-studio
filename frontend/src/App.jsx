import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useLayoutEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedLayout from './components/ProtectedLayout';
import AxlyLogo from './components/AxlyLogo';
import AdminRoute from './components/AdminRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import LinksPage from './pages/LinksPage';
import LinkDetailPage from './pages/LinkDetailPage';
import CampaignsPage from './pages/CampaignsPage';
import ExperimentsPage from './pages/ExperimentsPage';
import BulkImportPage from './pages/BulkImportPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import DeveloperPage from './pages/DeveloperPage';
import TeamsPage from './pages/TeamsPage';
import PagesPage from './pages/PagesPage';
import PublicPageView from './pages/PublicPageView';
import QrCodePage from './pages/QrCodePage';
import HelpPage from './pages/HelpPage';
import AdminPage from './pages/AdminPage';
import InfoPage from './pages/InfoPage';
import './index.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // Route changes should start at the top, even while the document uses smooth scrolling.
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previousScrollBehavior;
  }, [pathname]);

  return null;
}

function HomeRoute() {
  const host = window.location.hostname.toLowerCase();
  const axlyHost = host === 'url.axly.in' || host === 'axly.in' || host === 'localhost' ||
    host === '127.0.0.1' || host === 's.axly.in' || host === 'api.axly.in' ||
    host.endsWith('.vercel.app');
  return axlyHost ? <LandingPage /> : <PublicPageView customDomainHost={host} />;
}

function PublicQrPage() {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/app/qr" replace />;
  }
  return (
    <div className="landing-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="landing-nav">
        <Link to="/" className="nav-logo" aria-label="Axly Studio Home" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <AxlyLogo size="md" />
        </Link>
        <nav className="nav-links landing-nav-links">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/#shorten" className="nav-link">URL Shortener</Link>
          <Link to="/qr" className="nav-link active">QR Codes</Link>
          <Link to="/help" className="nav-link">Help</Link>
        </nav>
        <div className="nav-actions landing-nav-actions">
          <Link to="/login" className="btn btn-ghost">Sign in</Link>
          <Link to="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </header>
      <main style={{ flex: 1, padding: '32px 16px' }}>
        <QrCodePage />
      </main>
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand"><AxlyLogo size="sm" /></div>
          <p className="footer-copy">© 2026 Axly Studio. Built for speed, security, and privacy.</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/qr" element={<PublicQrPage />} />
            <Route path="/p/:slug" element={<PublicPageView />} />
            <Route path="/help" element={<InfoPage page="help" />} />
            <Route path="/contact" element={<InfoPage page="contact" />} />
            <Route path="/report-abuse" element={<InfoPage page="report-abuse" />} />
            <Route path="/security" element={<InfoPage page="security" />} />
            <Route path="/terms" element={<InfoPage page="terms" />} />
            <Route path="/privacy" element={<InfoPage page="privacy" />} />
            <Route path="/acceptable-use" element={<InfoPage page="acceptable-use" />} />

            {/* Standard user application workspace */}
            <Route path="/app" element={<ProtectedLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="links" element={<LinksPage />} />
              <Route path="qr" element={<QrCodePage />} />
              <Route path="pages" element={<PagesPage />} />
              <Route path="domains" element={<DeveloperPage initialTab="domains" />} />
              <Route path="links/:id" element={<LinkDetailPage />} />
              <Route path="campaigns" element={<CampaignsPage />} />
              <Route path="experiments" element={<ExperimentsPage />} />
              <Route path="teams" element={<TeamsPage />} />
              <Route path="developer" element={<DeveloperPage />} />
              <Route path="bulk" element={<BulkImportPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="analytics/:id" element={<AnalyticsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>

            {/* Administrative console route guarded by AdminRoute */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            {/* Backward-compatibility legacy redirects */}
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/links" element={<Navigate to="/app/links" replace />} />
            <Route path="/analytics/:id" element={<Navigate to="/app/links" replace />} />
            <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              boxShadow: 'var(--shadow-lg)',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: 'white' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: 'white' },
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
