export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-label="Morrow"
      role="img"
    >
      <path
        d="M8 47V19c0-3 3.5-4.5 5.7-2.5L32 33l18.3-16.5C52.5 14.5 56 16 56 19v28"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m20 45 12-11 12 11"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="11" r="3" fill="currentColor" />
    </svg>
  );
}
