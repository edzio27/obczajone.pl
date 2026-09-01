'use client';

import { useEffect, useRef, useState } from 'react';

type CountUpProps = {
  value: number;
  durationMs?: number;
  className?: string;
};

/**
 * Licznik dobijający do wartości, gdy wejdzie w kadr.
 *
 * Startowa wartość w stanie to od razu docelowa liczba - dzięki temu w HTML-u
 * renderowanym serwerowo stoi prawdziwa liczba, a nie zero. Animacja podmienia
 * ją dopiero po stronie klienta, więc ani wyszukiwarka, ani ktoś z wyłączonym
 * JS-em nie zobaczy "0 sprawdzonych ogłoszeń".
 */
export function CountUp({ value, durationMs = 1400, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof IntersectionObserver === 'undefined') return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          // easeOutExpo - szybki start, miękkie dobicie do wartości końcowej
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setDisplay(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        setDisplay(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('pl-PL')}
    </span>
  );
}
