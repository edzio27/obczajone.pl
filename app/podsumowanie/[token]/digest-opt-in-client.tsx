'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { CalendarCheck, CircleAlert, Loader as Loader2 } from 'lucide-react';

/**
 * Włączenie podsumowania potwierdzane kliknięciem, nie samym wejściem.
 *
 * Z tego samego powodu co wypisanie: skanery poczty i podglądy linków
 * otwierają adresy z wiadomości same. Zgoda na wiadomość ma pochodzić od
 * człowieka, a nie od filtra antyspamowego.
 */
export function DigestOptInClient({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'gone'>('idle');

  async function enable() {
    setState('working');
    const { data, error } = await supabase.rpc('enable_weekly_digest', { token });
    setState(!error && data === true ? 'done' : 'gone');
  }

  if (state === 'done') {
    return (
      <>
        <CalendarCheck className="h-10 w-10 mx-auto text-primary" />
        <h1 className="text-xl font-semibold">Włączone</h1>
        <p className="text-muted-foreground">
          W poniedziałki wyślemy Ci krótkie podsumowanie: co potaniało i co nowego w modelu,
          który obserwujesz. Wyłączysz je linkiem z każdego maila.
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
          Albo wypisałeś się z powiadomień, albo adres został skopiowany niekompletnie.
          Możesz zapisać się ponownie na stronie dowolnego ogłoszenia.
        </p>
        <BackLink />
      </>
    );
  }

  return (
    <>
      <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground" />
      <h1 className="text-xl font-semibold">Włączyć cotygodniowe podsumowanie?</h1>
      <p className="text-muted-foreground">
        Oprócz powiadomienia o spadku ceny w poniedziałki dostaniesz krótki mail: co potaniało
        i co nowego pojawiło się w obserwowanym modelu.
      </p>
      <Button onClick={enable} disabled={state === 'working'} className="mt-2">
        {state === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tak, włącz'}
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
