'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type RevealProps = {
  children: ReactNode;
  /** Opóźnienie w ms - do kaskadowego wjazdu kolejnych kafelków w siatce. */
  delay?: number;
  className?: string;
  as?: ElementType;
};

/**
 * Wjazd treści przy wejściu w kadr.
 *
 * Sama animacja siedzi w CSS (atrybut data-reveal w globals.css), tutaj jest
 * tylko obserwator. Dwa świadome ograniczenia: element odsłaniamy raz i od razu
 * odpinamy obserwatora, a przy braku IntersectionObserver albo przy włączonym
 * "ogranicz ruch" treść pokazuje się natychmiast. Element nigdy nie zostaje
 * niewidoczny - to jest cała treść strony, a nie ozdoba.
 */
export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as any}
      data-reveal=""
      data-revealed={revealed ? 'true' : 'false'}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
