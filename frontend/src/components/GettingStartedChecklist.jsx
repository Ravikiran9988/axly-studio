import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, Circle, ArrowRight, ChevronDown, ChevronUp, 
  X, Sparkles, QrCode, Link2, PanelsTopLeft, BarChart3, RotateCcw
} from 'lucide-react';

export default function GettingStartedChecklist({ stats, urls, onCreateLink, onOpenQr }) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('axly_checklist_dismissed') === 'true';
  });
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('axly_checklist_collapsed') === 'true';
  });
  const [manualChecks, setManualChecks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('axly_checklist_manual') || '{}');
    } catch {
      return {};
    }
  });

  // Calculate real reliable progress from backend data
  const hasCreatedLink = Boolean(stats?.totalUrls > 0 || urls?.length > 0);
  const hasCustomAlias = Boolean(urls?.some(u => u.custom_alias));
  const hasGeneratedQr = Boolean(manualChecks.qr);
  const hasBuiltPage = Boolean(manualChecks.page);
  const hasExploredAnalytics = Boolean(manualChecks.analytics);

  const steps = [
    {
      id: 'link',
      title: 'Create your first short link',
      desc: 'Shorten any long URL into a clean, trackable Axly link.',
      done: hasCreatedLink,
      action: onCreateLink ? (
        <button className="btn btn-secondary btn-sm" onClick={onCreateLink}>
          Shorten <ArrowRight size={13} />
        </button>
      ) : (
        <Link to="/app/links" className="btn btn-secondary btn-sm">
          My Links <ArrowRight size={13} />
        </Link>
      )
    },
    {
      id: 'alias',
      title: 'Customize a link alias',
      desc: 'Brand the ending of your short link (e.g. s.axly.in/summer-sale).',
      done: hasCustomAlias,
      action: onCreateLink ? (
        <button className="btn btn-secondary btn-sm" onClick={onCreateLink}>
          Set alias <ArrowRight size={13} />
        </button>
      ) : null
    },
    {
      id: 'qr',
      title: 'Generate your first QR code',
      desc: 'Create high-contrast vector and PNG QR codes for marketing.',
      done: hasGeneratedQr,
      action: (
        <Link 
          to="/app/qr" 
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const next = { ...manualChecks, qr: true };
            setManualChecks(next);
            localStorage.setItem('axly_checklist_manual', JSON.stringify(next));
          }}
        >
          Open QR Studio <ArrowRight size={13} />
        </Link>
      )
    },
    {
      id: 'page',
      title: 'Build your public profile page',
      desc: 'Centralize your portfolio, links, and contact bio into one page.',
      done: hasBuiltPage,
      action: (
        <Link 
          to="/app/pages" 
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const next = { ...manualChecks, page: true };
            setManualChecks(next);
            localStorage.setItem('axly_checklist_manual', JSON.stringify(next));
          }}
        >
          My Pages <ArrowRight size={13} />
        </Link>
      )
    },
    {
      id: 'analytics',
      title: 'Explore link analytics',
      desc: 'Understand unique visitors, referrers, and device breakdown.',
      done: hasExploredAnalytics,
      action: (
        <Link 
          to="/app/analytics" 
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const next = { ...manualChecks, analytics: true };
            setManualChecks(next);
            localStorage.setItem('axly_checklist_manual', JSON.stringify(next));
          }}
        >
          Analytics <ArrowRight size={13} />
        </Link>
      )
    }
  ];

  const completedCount = steps.filter(s => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('axly_checklist_dismissed', 'true');
  };

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('axly_checklist_collapsed', String(next));
  };

  if (dismissed) {
    return null;
  }

  return (
    <div 
      className="card getting-started-card"
      style={{
        padding: '20px 24px',
        marginBottom: 24,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        position: 'relative',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'rgba(37,99,235,0.1)', color: 'var(--brand-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Getting Started with Axly Studio
              </h3>
              <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                {completedCount} of {steps.length} completed
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Follow these simple steps to set up your link management and digital presence.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button 
            type="button" 
            onClick={handleToggleCollapse}
            className="copy-btn"
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
            title={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <span>{collapsed ? 'Show' : 'Hide'}</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="copy-btn"
            style={{ padding: '6px 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}
            title="Dismiss checklist (can be reopened from Help & Guides)"
          >
            <X size={14} /> Dismiss
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ margin: '14px 0 10px' }}>
        <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${progressPercent}%`, 
              height: '100%', 
              background: 'var(--brand-primary)',
              transition: 'width 0.3s ease' 
            }} 
          />
        </div>
      </div>

      {/* Checklist items */}
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {steps.map(step => (
            <div 
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: step.done ? 'rgba(16,185,129,0.04)' : 'var(--bg-secondary)',
                border: '1px solid ' + (step.done ? 'rgba(16,185,129,0.2)' : 'var(--border-color)'),
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {step.done ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                ) : (
                  <Circle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ 
                    fontSize: '0.88rem', 
                    fontWeight: 600, 
                    color: step.done ? 'var(--text-secondary)' : 'var(--text-primary)',
                    textDecoration: step.done ? 'line-through' : 'none'
                  }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {step.desc}
                  </div>
                </div>
              </div>

              {!step.done && step.action && (
                <div style={{ marginLeft: 12, flexShrink: 0 }}>
                  {step.action}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
