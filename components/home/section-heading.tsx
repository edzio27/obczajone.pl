import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type SectionHeadingProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  align?: 'left' | 'center';
  action?: { href: string; label: string };
  className?: string;
};

/**
 * Jeden nagłówek sekcji dla całej strony głównej. Wcześniej każda sekcja
 * powtarzała własny zestaw klas i żadne dwie nie miały tego samego odstępu
 * ani wielkości - stąd wrażenie, że strona składa się z doklejanych kawałków.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  icon: Icon,
  align = 'left',
  action,
  className,
}: SectionHeadingProps) {
  const centered = align === 'center';

  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        centered && 'md:flex-col md:items-center text-center',
        className
      )}
    >
      <div className={cn('max-w-2xl', centered && 'mx-auto')}>
        {eyebrow && (
          <div
            className={cn(
              'mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary',
              centered && 'justify-center'
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {eyebrow}
          </div>
        )}
        <h2
          id={id}
          className="text-[1.75rem] leading-[1.15] md:text-4xl font-extrabold text-foreground text-balance"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-2.5 text-[15px] md:text-base text-muted-foreground leading-relaxed text-pretty">
            {description}
          </p>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className="group inline-flex flex-shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all duration-200 ease-spring"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
