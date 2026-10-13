import BrandMark from './BrandMark';

export default function AxlyLogo({
  size = 'md',
  variant = 'full',
  showSubtitle = true,
  className = '',
  style = {},
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

  // Use the original Axly geometric A mark throughout the product.
  const iconSvg = variant === 'icon' ? (
    <BrandMark size={px} className="axly-brand-icon" />
  ) : (
    <div
      className="logo-icon axly-logo-mark"
      style={{
        width: px,
        height: px,
        minWidth: px,
        minHeight: px,
        borderRadius: Math.max(6, Math.round(px * 0.25)),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <BrandMark size={Math.max(12, Math.round(px * 0.66))} />
    </div>
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
            gap: 4,
          }}
        >
          Axly
          <span style={{ color: 'var(--brand-primary, #7c3aed)', fontWeight: 700 }}>Studio</span>
        </span>
        {showSubtitle && (
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Link Platform
          </span>
        )}
      </div>
    </div>
  );
}
