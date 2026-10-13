export default function AxlyLogo({ 
  size = 'md', 
  variant = 'full', 
  showSubtitle = true,
  className = '',
  style = {}
}) {
  const iconSizes = {
    xs: 18,
    sm: 24,
    md: 32,
    lg: 40,
    xl: 48,
  };

  const textSizes = {
    xs: '0.95rem',
    sm: '1.1rem',
    md: '1.28rem',
    lg: '1.5rem',
    xl: '1.8rem',
  };

  const px = typeof size === 'number' ? size : iconSizes[size] || 32;
  const fontSize = typeof size === 'number' ? `${size * 0.4}px` : textSizes[size] || '1.28rem';

  // Original geometric brand mark: Twin linked precision arcs converging at forward focal point
  const iconSvg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="axly-brand-icon"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="axly-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="axly-grad-accent" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* Background rounded foundation tile */}
      <rect width="48" height="48" rx="12" fill="url(#axly-grad-primary)" />

      {/* Left node anchor loop */}
      <path
        d="M14 24C14 19.5817 17.5817 16 22 16H25C26.1046 16 27 16.8954 27 18C27 19.1046 26.1046 20 25 20H22C19.7909 20 18 21.7909 18 24C18 26.2091 19.7909 28 22 28H25C26.1046 28 27 28.8954 27 30C27 31.1046 26.1046 32 25 32H22C17.5817 32 14 28.4183 14 24Z"
        fill="#ffffff"
        opacity="0.95"
      />

      {/* Right destination node loop */}
      <path
        d="M34 24C34 28.4183 30.4183 32 26 32H23C21.8954 32 21 31.1046 21 30C21 28.8954 21.8954 28 23 28H26C28.2091 28 30 26.2091 30 24C30 21.7909 28.2091 20 26 20H23C21.8954 20 21 19.1046 21 18C21 16.8954 21.8954 16 23 16H26C30.4183 16 34 19.5817 34 24Z"
        fill="#ffffff"
        opacity="0.95"
      />

      {/* Central connective nexus beam */}
      <rect x="20" y="22" width="8" height="4" rx="2" fill="url(#axly-grad-accent)" />

      {/* Precision destination dot */}
      <circle cx="34" cy="15" r="2.5" fill="#38bdf8" />
    </svg>
  );

  if (variant === 'icon') {
    return iconSvg;
  }

  return (
    <div 
      className={`axly-logo ${className}`} 
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', userSelect: 'none', ...style }}
    >
      {iconSvg}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span 
          style={{ 
            fontFamily: 'var(--font-display, inherit)',
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          Axly
          <span style={{ color: 'var(--brand-primary, #2563eb)', fontWeight: 700 }}>Studio</span>
        </span>
        {showSubtitle && (
          <span 
            style={{ 
              fontSize: '0.66rem', 
              fontWeight: 600, 
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)' 
            }}
          >
            Link Platform
          </span>
        )}
      </div>
    </div>
  );
}
