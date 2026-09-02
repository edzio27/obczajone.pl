'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { CalendarX, Car, HandCoins, PhoneOff, Eye } from 'lucide-react';

/**
 * Sygnały o ogłoszeniu, jednym kliknięciem i bez konta.
 *
 * Stoją nad opisem, a nie w sekcji opinii na dole, bo mają dwie publiczności:
 * odwiedzającego, który w pół sekundy widzi, że ogłoszenie jest nieaktualne
 * albo sprzedawca nie odbiera, i tego, kto właśnie wrócił z oględzin i ma
 * dziesięć sekund cierpliwości. Formularz opinii zostaje - to dwie różne
 * rzeczy: tam jest relacja, tu jest fakt.
 */

const SIGNALS = [
  { kind: 'sold', label: 'Ogłoszenie nieaktualne', icon: CalendarX },
  { kind: 'price_differs', label: 'Cena inna niż w ogłoszeniu', icon: HandCoins },
  { kind: 'no_answer', label: 'Sprzedawca nie odbiera', icon: PhoneOff },
  { kind: 'differs', label: 'Auto wygląda inaczej', icon: Car },
  { kind: 'visited', label: 'Byłem/byłam oglądać', icon: Eye },
] as const;

type SignalKind = (typeof SIGNALS)[number]['kind'];

/** Klucz w localStorage: co ta przeglądarka już zgłosiła przy tym ogłoszeniu. */
function storageKey(listingId: string) {
  return `obczajone:signals:${listingId}`;
}

function readSent(listingId: string): SignalKind[] {
  try {
    const raw = window.localStorage.getItem(storageKey(listingId));
    return raw ? (JSON.parse(raw) as SignalKind[]) : [];
  } catch {
    // Prywatne okno albo zablokowane dane witryny - wtedy po prostu nie
    // pamiętamy, co ktoś kliknął. Licznik po stronie bazy i tak pilnuje reszty.
    return [];
  }
}

function rememberSent(listingId: string, kinds: SignalKind[]) {
  try {
    window.localStorage.setItem(storageKey(listingId), JSON.stringify(kinds));
  } catch {
    /* jak wyżej - brak pamięci nie może wywrócić kliknięcia */
  }
}

export function ListingSignals({ listingId }: { listingId: string }) {
  const { toast } = useToast();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sent, setSent] = useState<SignalKind[]>([]);
  const [pending, setPending] = useState<SignalKind | null>(null);

  const loadCounts = useCallback(async () => {
    const { data } = await supabase
      .from('listing_signals')
      .select('kind')
      .eq('listing_id', listingId)
      .limit(500);

    const next: Record<string, number> = {};
    for (const row of (data as { kind: string }[]) || []) {
      next[row.kind] = (next[row.kind] ?? 0) + 1;
    }
    setCounts(next);
  }, [listingId]);

  useEffect(() => {
    setSent(readSent(listingId));
    loadCounts();
  }, [listingId, loadCounts]);

  async function send(kind: SignalKind) {
    if (sent.includes(kind) || pending) return;

    setPending(kind);

    // Licznik rośnie od razu: to jedno kliknięcie i czekanie na bazę
    // wyglądałoby jak przycisk, który nie zadziałał.
    setCounts((current) => ({ ...current, [kind]: (current[kind] ?? 0) + 1 }));
    const nextSent = [...sent, kind];
    setSent(nextSent);
    rememberSent(listingId, nextSent);

    const { error } = await supabase.from('listing_signals').insert({
      listing_id: listingId,
      kind,
    });

    setPending(null);

    if (error) {
      setCounts((current) => ({
        ...current,
        [kind]: Math.max(0, (current[kind] ?? 1) - 1),
      }));
      setSent(sent);
      rememberSent(listingId, sent);
      toast({
        title: 'Nie udało się zapisać',
        description: error.message?.includes('listing_signal_flood')
          ? 'Przy tym ogłoszeniu jest już dużo takich zgłoszeń. Spróbuj później.'
          : 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Dzięki',
      description: 'Następny kupujący zobaczy to przy ogłoszeniu.',
    });
  }

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {total > 0
          ? 'Co zgłosili inni oglądający — kliknij, jeśli u Ciebie było tak samo:'
          : 'Byłeś przy tym aucie? Kliknij, co się zgadzało — bez zakładania konta.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {SIGNALS.map(({ kind, label, icon: Icon }) => {
          const count = counts[kind] ?? 0;
          const alreadySent = sent.includes(kind);

          return (
            <button
              key={kind}
              type="button"
              onClick={() => send(kind)}
              disabled={alreadySent || pending !== null}
              aria-pressed={alreadySent}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                alreadySent
                  ? 'border-primary/40 bg-primary/10 text-primary cursor-default'
                  : 'border-input hover:bg-accent hover:text-accent-foreground'
              } ${pending !== null && !alreadySent ? 'opacity-60' : ''}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count > 0 && (
                <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-xs font-medium">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
