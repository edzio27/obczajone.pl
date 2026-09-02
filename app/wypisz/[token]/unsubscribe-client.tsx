'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { BellOff, CircleAlert, Loader as Loader2 } from 'lucide-react';

/**
 * Wypisanie potwierdzane kliknięciem, a nie wykonywane samym wejściem na adres.
 *
 * Link z maila otwierają nie tylko ludzie: skanery bezpieczeństwa i podglądy
 * linków w klientach pocztowych chodzą po adresach z wiadomości same z siebie.
 * Gdyby samo GET kasowało wiersz, firmowy filtr poczty wypisywałby odbiorcę,
 * zanim ten w ogóle otworzy wiadomość - a on nigdy by się nie dowiedział,
 * dlaczego przestały przychodzić powiadomienia.
 */
export function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'gone'>('idle');

  async function unsubscribe() {
    setState('working');
    const { data, error } = await supabase.rpc('unsubscribe_price_watch', { token });
    setState(!error && data === true ? 'done' : 'gone');
  }

  if (state === 'done') {
    return (
      <>
        <BellOff className="h-10 w-10 mx-auto text-primary" />
        <h1 className="text-xl font-semibold">Wypisano</h1>
        <p className="text-muted-foreground">
          Nie wyślemy już powiadomień o cenie tego ogłoszenia, a Twój adres został usunięty
          z naszej bazy.
        </p>
        <BackLink />
      </>
    );
  }

  if (state === 'gone') {
    return (
      <>
        <CircleAlert className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Ten link już nie działa</h1>
        <p className="text-muted-foreground">
          Albo wypisałeś się wcześniej, albo adres został skopiowany niekompletnie. Tak czy
          inaczej nie ma tu nic do zrobienia — nie wyślemy Ci już nic.
        </p>
        <BackLink />
      </>
    );
  }

  return (
    <>
      <BellOff className="h-10 w-10 mx-auto text-muted-foreground" />
      <h1 className="text-xl font-semibold">Wypisać Cię z powiadomień?</h1>
      <p className="text-muted-foreground">
        Przestaniemy wysyłać powiadomienia o spadku ceny tego ogłoszenia, a Twój adres
        e-mail usuniemy z naszej bazy.
      </p>
      <Button onClick={unsubscribe} disabled={state === 'working'} className="mt-2">
        {state === 'working' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          'Tak, wypisz mnie'
        )}
      </Button>
      <BackLink />
    </>
  );
}

function BackLink() {
  return (
    <p className="pt-2">
      <Link href="/" className="text-primary hover:underline">
        Wróć na obczajone.pl
      </Link>
    </p>
  );
}
