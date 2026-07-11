import { useId } from 'react';

type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="obczajone.pl"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path
        d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M32 52L46 66L70 34"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
