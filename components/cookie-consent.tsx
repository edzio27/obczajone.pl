'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'cookie-consent-ack';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          Używamy niezbędnych plików cookie do działania serwisu. Więcej informacji znajdziesz w{' '}
          <Link href="/polityka-prywatnosci" className="underline hover:text-primary transition-colors">
            polityce prywatności
          </Link>.
        </p>
        <Button size="sm" onClick={accept} className="shrink-0 whitespace-nowrap">
          Akceptuję
        </Button>
      </div>
    </div>
  );
}
