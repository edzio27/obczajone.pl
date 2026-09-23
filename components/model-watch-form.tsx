'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { BellRing, Loader as Loader2 } from 'lucide-react';

/**
 * Alert na model, nie na pojedyncze ogłoszenie.
 *
 * Obserwowanie jednej oferty ma wbudowaną datę ważności — ogłoszenie znika ze
 * źródła po kilku tygodniach i alert przestaje cokolwiek znaczyć. Kupujący
 * zwykle nie szuka tego jednego egzemplarza, tylko auta, i jest gotów poczekać
 * na tańszy. Ten formularz odpowiada na to drugie.
 */
export function ModelWatchForm({
  brand,
  model,
  medianPrice,
}: {
  brand: string;
  model: string;
  /** Podpowiedź kwoty — pułap poniżej mediany jest tym, czego ludzie szukają. */
  medianPrice: number | null;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ maxPrice: number | null } | null>(null);

  const podpowiedz =
    medianPrice != null ? Math.round((medianPrice * 0.9) / 1000) * 1000 : null;

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

    // Puste pole znaczy "każda cena" i jest poprawnym wyborem, nie brakiem danych.
    const cleaned = maxPrice.replace(/[^\d]/g, '');
    const parsed = cleaned ? Number(cleaned) : null;

    if (parsed != null && (parsed <= 0 || parsed >= 100_000_000)) {
      toast({
        title: 'Sprawdź kwotę',
        description: 'Podaj kwotę w złotych, bez groszy.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('model_price_watchers')
      .insert({ brand, model, email: trimmed, max_price: parsed });

    setSaving(false);

    // Drugie kliknięcie tego samego przycisku znaczy dla człowieka to samo,
    // co pierwsze — nie ma po co pokazywać mu błędu.
    const duplicate = error?.message?.includes('model_price_watchers_one_per_model');

    if (error && !duplicate) {
      toast({
        title: 'Nie udało się zapisać',
        description: error.message?.includes('model_watcher_flood')
          ? 'Przy tym modelu jest teraz dużo zapisów. Spróbuj za chwilę.'
          : 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
      return;
    }

    setDone({ maxPrice: parsed });
    setEmail('');
    setMaxPrice('');
  }

  if (done) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-primary">
          {done.maxPrice
            ? `Damy znać, gdy pojawi się ${brand} ${model} poniżej ${done.maxPrice.toLocaleString('pl-PL')} zł.`
            : `Damy znać, gdy pojawi się nowa oferta: ${brand} ${model}.`}
        </p>
        <p className="text-muted-foreground mt-1">
          Najwyżej jeden mail dziennie i tylko o ofertach, których wcześniej nie było.
          W każdej wiadomości jest link, którym się wypiszesz.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={subscribe} className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BellRing className="h-4 w-4 text-primary" />
        Szukasz takiego auta? Damy znać, gdy się pojawi
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          aria-label={`Adres e-mail do powiadomień o modelu ${brand} ${model}`}
          className="bg-background"
        />
        <Input
          type="text"
          inputMode="numeric"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          placeholder={podpowiedz ? `do ${podpowiedz.toLocaleString('pl-PL')} zł` : 'do ilu zł'}
          aria-label="Maksymalna cena (opcjonalnie)"
          className="bg-background sm:max-w-[160px]"
        />
        <Button type="submit" disabled={saving} className="sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Obserwuj model'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Kwotę możesz zostawić pustą — wtedy napiszemy o każdej nowej ofercie tego modelu.
        Bez zakładania konta, wypisujesz się linkiem z maila.
      </p>
    </form>
  );
}
