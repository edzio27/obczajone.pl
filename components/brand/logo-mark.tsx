type LogoMarkProps = {
  size?: number;
  className?: string;
};

// Znak dziedziczy kolor marki z tokenów, zamiast trzymać własny hex. Dzięki
// temu na ciemnych sekcjach (.surface-ink) rozjaśnia się razem z resztą UI.
const BRAND_BLUE = 'hsl(var(--primary))';

export function LogoMark({ size, className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      {...(size ? { width: size, height: size } : {})}
      className={className}
      role="img"
      aria-label="obczajone.pl"
      fill="none"
      stroke={BRAND_BLUE}
      strokeWidth={6.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="10" y="6" width="48" height="74" rx="10" />
      <circle cx="21" cy="27" r="4" fill={BRAND_BLUE} stroke="none" />
      <line x1="33" y1="27" x2="49" y2="27" />
      <circle cx="21" cy="43" r="4" fill={BRAND_BLUE} stroke="none" />
      <line x1="33" y1="43" x2="49" y2="43" />
      <circle cx="21" cy="59" r="4" fill={BRAND_BLUE} stroke="none" />
      <line x1="33" y1="59" x2="45" y2="59" />
      <circle cx="66" cy="62" r="16" />
      <line x1="77" y1="73" x2="91" y2="87" strokeWidth={8} />
    </svg>
  );
}
