/**
 * Axly Studio's signature mark: a geometric A with a destination node.
 * It is intentionally an original monogram rather than a generic chain icon.
 */
export default function BrandMark({ size = 22, className, title }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <path
        d="M8.7 30.5 17.15 12.25c1.12-2.42 4.58-2.42 5.7 0L31.3 30.5"
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.55 23.7h12.9"
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <circle cx="30" cy="9.5" r="3.25" fill="currentColor" />
      <path
        d="m30 3.8.1 1.25"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
