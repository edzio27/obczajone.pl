'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pasek akcji przyklejony do dołu ekranu na telefonie.
 *
 * Strona główna jest długa, a obie rzeczy, po które ktoś tu przychodzi -
 * wyszukiwarka i zamówienie oględzin - stoją na samej górze. Po dwóch
 * przewinięciach nie ma już na ekranie żadnego wejścia w jedną ani w drugą.
 *
 * Pasek pojawia się dopiero po zjechaniu poniżej pierwszego ekranu, żeby nie
 * zasłaniać wyszukiwarki wtedy, gdy ta i tak jest widoczna - i żeby nie liczył
 * się jako natrętny interstitial przy wejściu z wyszukiwarki.
 */
export function MobileActionBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Odsyłamy do wyszukiwarki w nagłówku i od razu ustawiamy w niej kursor -
  // samo przewinięcie na górę zostawiałoby użytkownika przed jeszcze jednym
  // kliknięciem. Gdy pola nie ma (podstrona bez wyszukiwarki), zostaje przewinięcie.
  const focusSearch = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const input = document.querySelector<HTMLInputElement>('input[type="url"]');
    if (input) window.setTimeout(() => input.focus({ preventScroll: true }), 450);
  };

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 md:hidden transition-all duration-300 ease-spring',
        // pointer-events-none w stanie ukrytym, żeby niewidoczny pasek nie
        // przechwytywał dotknięć w treści pod spodem
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      )}
    >
      <div className="glass border-t border-border px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={focusSearch}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold text-foreground"
          >
            <Search className="h-4 w-4" />
            Sprawdź ogłoszenie
          </button>

          <Link
            href="/partnerzy"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-signal text-sm font-bold text-signal-foreground shadow-glow-signal"
          >
            <ShieldCheck className="h-4 w-4" />
            Zamów inspekcję
          </Link>
        </div>
      </div>
    </div>
  );
}
