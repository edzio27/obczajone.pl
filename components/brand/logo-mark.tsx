type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="obczajone.pl"
    >
      <circle cx="50" cy="50" r="38" stroke="#0F2A4A" strokeWidth="10" fill="none" />
      <path
        d="M32 52L46 66L70 34"
        stroke="#16A34A"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
