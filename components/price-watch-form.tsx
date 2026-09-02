'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { BellRing, Loader as Loader2 } from 'lucide-react';

/**
 * Alert cenowy dla kogoś bez konta.
 *
 * Ta sama obietnica co przycisk "powiadom mnie o spadku ceny" obok, tylko bez
 * pięciu kroków przed nią: rejestracji, potwierdzenia maila, logowania,
 * polubienia ogłoszenia i zaznaczenia checkboxa. Przy dziesięciu kontach
 * w serwisie tamta ścieżka nie zebrała ani jednego obserwującego.
 */
export function PriceWatchForm({ listingId }: { listingId: string }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function subscribe(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(trimmed)) {
      toast({
        title: 'Sprawdź adres',
        description: 'To nie wygląda na adres e-mail.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('listing_price_watchers')
      .insert({ listing_id: listingId, email: trimmed });

    setSaving(false);

    // Ten sam adres przy tym samym ogłoszeniu to nie błąd, tylko drugie
    // kliknięcie tego samego przycisku - i dla człowieka znaczy dokładnie to,
    // co pierwsze.
    const duplicate = error?.message?.includes('listing_price_watchers_one_per_listing');

    if (error && !duplicate) {
      toast({
        title: 'Nie udało się zapisać',
        description: error.message?.includes('price_watcher_flood')
          ? 'Przy tym ogłoszeniu jest już dużo zapisów. Spróbuj później.'
          : 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
      return;
    }

    setDone(true);
    setEmail('');
  }

  if (done) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-primary">Damy znać, gdy cena spadnie.</p>
        <p className="text-muted-foreground mt-1">
          Jeden mail, tylko przy realnej obniżce. W każdej wiadomości jest link, którym się
          wypiszesz.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={subscribe} className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BellRing className="h-4 w-4 text-primary" />
        Powiadomimy Cię, gdy cena spadnie
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          aria-label="Adres e-mail do powiadomienia o spadku ceny"
          className="bg-background"
        />
        <Button type="submit" disabled={saving} className="sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Obserwuj cenę'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Bez zakładania konta. Adresu używamy wyłącznie do tego jednego powiadomienia i
        wypiszesz się linkiem z maila.
      </p>
    </form>
  );
}
