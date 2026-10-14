export default function TelegramIcon({ 
  size = 20, 
  className = '', 
  color = 'currentColor', 
  variant = 'default',
  style = {} 
}) {
  if (variant === 'circle') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        style={style}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="12" fill="url(#tg-grad)" />
        <path
          d="M5.4 12.05l3.96 1.48 1.53 4.96c.19.61.9.83 1.39.43l2.25-1.85 4.38 3.23c.77.57 1.9-.02 1.83-.98l2.05-12.82c.08-1.07-.98-1.87-1.95-1.48L3.84 10.53c-1.04.42-.99 1.91.16 2.26l1.4.26z"
          fill="#ffffff"
        />
        <defs>
          <linearGradient id="tg-grad" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2AABEE" />
            <stop offset="1" stopColor="#229ED9" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // Standard crisp paper plane path from official Telegram vector
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.536-.196 1.006.128.832.939z" />
    </svg>
  );
}
