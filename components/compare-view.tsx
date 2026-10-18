'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, ExternalLink, Link2, Loader2, X } from 'lucide-react';
import { ListingUrlForm } from '@/components/listing-url-form';
import { ModelWatchInline } from '@/components/model-watch-inline';
import { supabase } from '@/lib/supabase';
import { fetchCompareCars, type CompareCar } from '@/lib/compare-data';
import { MAX_COMPARE, useCompareList } from '@/lib/compare-store';
import { largePhotoUrl } from '@/lib/photo-url';
import { useToast } from '@/hooks/use-toast';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pln(v: number): string {
  return `${Math.round(v).toLocaleString('pl-PL')} zł`;
}

function percent(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

type Row = {
  label: string;
  value: (c: CompareCar) => React.ReactNode;
  /** Liczba, po której wybieramy najlepsze auto w wierszu; brak = bez wyróżnienia. */
  score?: (c: CompareCar) => number | null;
  best?: 'min' | 'max';
};

const ROWS: Row[] = [
  { label: 'Cena', value: (c) => <span className="text-lg font-bold">{pln(c.price)}</span>, score: (c) => c.price, best: 'min' },
  {
    label: 'Zmiana ceny',
    value: (c) =>
      c.changePercent == null || Math.abs(c.changePercent) < 0.05 ? (
        'bez zmian'
      ) : (
        <span className={c.changePercent < 0 ? 'text-success font-semibold' : 'text-warning font-semibold'}>
          {percent(c.changePercent)}
          {c.firstPrice ? <span className="block text-xs font-normal text-muted-foreground">z {pln(c.firstPrice)}</span> : null}
        </span>
      ),
    score: (c) => c.changePercent,
    best: 'min',
  },
  { label: 'Obniżki ceny', value: (c) => (c.dropCount === 0 ? 'żadnej' : `${c.dropCount}×`) },
  {
    // „Od kiedy je widzimy”, nie „ile wisi na Otomoto”: data wystawienia jest
    // znana tylko dla ogłoszeń wklejonych ręcznie, przeloty jej nie zapisują.
    label: 'Obserwujemy od',
    value: (c) => (c.daysListed == null ? '—' : `${c.daysListed} ${c.daysListed === 1 ? 'dnia' : 'dni'}`),
  },
  { label: 'Rocznik', value: (c) => c.year ?? '—', score: (c) => c.year, best: 'max' },
  {
    label: 'Przebieg',
    value: (c) => (c.mileage == null ? '—' : `${c.mileage.toLocaleString('pl-PL')} km`),
    score: (c) => c.mileage,
    best: 'min',
  },
  { label: 'Paliwo', value: (c) => c.fuel ?? '—' },
  { label: 'Moc', value: (c) => c.power ?? '—' },
  { label: 'Lokalizacja', value: (c) => c.location ?? '—' },
  {
    label: 'Ocena ceny',
    value: (c) =>
      c.verdict ? (
        <span>
          <span className="font-semibold">{c.verdict.label}</span>
          {c.medianPrice != null && (
            <span className="block text-xs text-muted-foreground">mediana {pln(c.medianPrice)}</span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">za mało podobnych ofert</span>
      ),
    score: (c) => c.verdict?.percentVsMedian ?? null,
    best: 'min',
  },
  {
    label: 'Propozycja na start',
    value: (c) =>
      c.negotiation ? (
        <span>
          <span className="font-semibold">ok. {pln(c.negotiation.suggestedOffer)}</span>
          <span className="block text-xs text-muted-foreground">−{pln(c.negotiation.suggestedDiscount)}</span>
        </span>
      ) : (
        '—'
      ),
  },
  {
    label: 'Status',
    value: (c) => (
      <span>
        <span className={c.isActive ? 'font-medium' : 'font-medium text-muted-foreground'}>
          {c.isActive ? 'aktywne' : 'zdjęte z serwisu'}
        </span>
        {c.lastCheckedAt && (
          <span className="block text-xs text-muted-foreground">
            sprawdzone {formatDistanceToNow(new Date(c.lastCheckedAt), { addSuffix: true, locale: pl })}
          </span>
        )}
      </span>
    ),
  },
];

/** Indeks auta z najlepszą wartością w wierszu, jeśli jest jednoznaczne. */
function bestIndex(cars: CompareCar[], row: Row): number | null {
  if (!row.score || !row.best || cars.length < 2) return null;
  const scored = cars.map((c, i) => ({ i, v: row.score!(c) })).filter((x): x is { i: number; v: number } => x.v != null);
  if (scored.length < 2) return null;
  const pick = scored.reduce((a, b) => (row.best === 'min' ? (b.v < a.v ? b : a) : b.v > a.v ? b : a));
  const ties = scored.filter((x) => x.v === pick.v).length;
  return ties === 1 ? pick.i : null;
}

/**
 * Porównanie aut obok siebie.
 *
 * Kupujący ogląda zwykle kilka ofert naraz i do tej pory porównywał je
 * w głowie albo w notatkach. Tu ma je w jednej tabeli, z tym, czego Otomoto
 * nie pokaże: zmianą ceny, liczbą obniżek, oceną na tle rynku i propozycją
 * na start rozmowy. Lista żyje w przeglądarce; `?ids=` w adresie pozwala ją
 * komuś wysłać.
 */
export function CompareView() {
  const params = useSearchParams();
  const { toast } = useToast();
  const { ids: storedIds, replace } = useCompareList();

  const sharedIds = useMemo(
    () => (params.get('ids') ?? '').split(',').filter((id) => UUID.test(id)).slice(0, MAX_COMPARE),
    [params]
  );
  // Link od kogoś wygrywa z własną listą przy pierwszym wejściu, potem liczy się już lista.
  const [useShared, setUseShared] = useState(sharedIds.length > 0);
  const ids = useShared ? sharedIds : storedIds;

  const [cars, setCars] = useState<CompareCar[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      setCars([]);
      return;
    }
    setCars(null);
    fetchCompareCars(supabase, ids)
      .then((result) => !cancelled && setCars(result))
      .catch(() => !cancelled && setCars([]));
    return () => {
      cancelled = true;
    };
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Porównywane auta to auta, którymi ktoś się interesuje: trafiają do
  // codziennego sprawdzania ceny tak samo jak oglądane.
  useEffect(() => {
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent)) return;
    for (const id of ids) {
      supabase.rpc('mark_listing_viewed', { p_listing_id: id }).then(() => {});
    }
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Każda zmiana listy przechodzi na własną listę i aktualizuje adres do udostępnienia.
  function commit(next: string[]) {
    replace(next);
    setUseShared(false);
    window.history.replaceState(null, '', next.length ? `/porownaj?ids=${next.join(',')}` : '/porownaj');
  }

  function handleAdd(id: string) {
    const base = useShared ? sharedIds : storedIds;
    if (base.includes(id)) return;
    if (base.length >= MAX_COMPARE) {
      toast({ title: `Najwyżej ${MAX_COMPARE} aut`, description: 'Usuń któreś, żeby dodać kolejne.' });
      return;
    }
    commit([...base, id]);
  }

  function handleRemove(id: string) {
    commit(ids.filter((x) => x !== id));
  }

  async function copyLink() {
    const url = `${window.location.origin}/porownaj?ids=${ids.join(',')}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link skopiowany', description: 'Wyślij go komuś, kto pomaga Ci wybrać auto.' });
    } catch {
      window.prompt('Skopiuj link do porównania:', url);
    }
  }

  return (
    <div className="space-y-8">
      {useShared && sharedIds.length > 0 && storedIds.length > 0 && sharedIds.join(',') !== storedIds.join(',') && (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>Oglądasz porównanie z udostępnionego linku. Twoja własna lista czeka obok.</span>
          <button type="button" onClick={() => setUseShared(false)} className="font-semibold text-primary hover:underline">
            Pokaż moją listę
          </button>
        </div>
      )}

      {ids.length < MAX_COMPARE && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Dodaj auto: wklej link z Otomoto ({ids.length}/{MAX_COMPARE}).
          </p>
          <ListingUrlForm onListing={handleAdd} submitLabel="Dodaj do porównania" />
        </div>
      )}

      {cars === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Wczytuję auta…
        </p>
      ) : cars.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-semibold">Nie masz jeszcze aut w porównaniu</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Wklej link powyżej albo kliknij „Dodaj do porównania” na stronie dowolnego ogłoszenia.
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <Link2 className="h-4 w-4" />
              Kopiuj link do porównania
            </button>
          </div>

          {/* Przewija się sama tabela, nie strona: przy pięciu autach na telefonie
              inaczej nie da się tego pokazać. Pierwsza kolumna stoi w miejscu. */}
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-28 min-w-[7rem] bg-card" />
                  {cars.map((c) => (
                    <th key={c.id} className="min-w-[11rem] border-l p-3 text-left align-top font-normal">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => handleRemove(c.id)}
                          className="absolute right-1 top-1 z-10 rounded-full bg-background/90 p-1 text-muted-foreground shadow hover:text-foreground"
                          aria-label={`Usuń ${c.title} z porównania`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                          {c.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={largePhotoUrl(c.imageUrl)} alt={c.title} className="h-full w-full object-cover" />
                          )}
                        </div>
                      </div>
                      <Link href={`/listing/${c.id}`} className="mt-2 block font-semibold leading-snug hover:text-primary">
                        {c.title}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const best = bestIndex(cars, row);
                  return (
                    <tr key={row.label} className="border-t">
                      <th className="sticky left-0 z-10 bg-card p-3 text-left text-xs font-medium text-muted-foreground">
                        {row.label}
                      </th>
                      {cars.map((c, i) => (
                        <td key={c.id} className={`border-l p-3 align-top ${best === i ? 'bg-success/10' : ''}`}>
                          <span className="inline-flex items-start gap-1">
                            {best === i && <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />}
                            <span>{row.value(c)}</span>
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t">
                  <th className="sticky left-0 z-10 bg-card p-3" />
                  {cars.map((c) => (
                    <td key={c.id} className="border-l p-3 align-top space-y-1.5">
                      <Link href={`/listing/${c.id}`} className="block text-sm font-semibold text-primary hover:underline">
                        Historia ceny →
                      </Link>
                      {c.isActive && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Otwórz na {c.source === 'otodom' ? 'Otodom' : 'Otomoto'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Kto porównuje kilka aut, szuka modelu, a nie egzemplarza: alert na
              każdy porównywany model, najwyżej trzy. */}
          {(() => {
            const models = Array.from(
              new Map(
                cars
                  .filter((c) => c.isActive && c.watchModel)
                  .map((c) => [`${c.watchModel!.brand}|${c.watchModel!.model}`, c.watchModel!])
              ).values()
            ).slice(0, 3);
            if (models.length === 0) return null;
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {models.map((m) => (
                  <div key={`${m.brand}|${m.model}`} className="rounded-xl border">
                    <ModelWatchInline brand={m.brand} model={m.model} medianPrice={m.medianPrice} />
                  </div>
                ))}
              </div>
            );
          })()}

          <p className="text-xs text-muted-foreground">
            Zielonym zaznaczamy najlepszą wartość w wierszu, gdy jest jednoznaczna. Ceny ofertowe, nie
            transakcyjne; ocena ceny porównuje auto z podobnymi ofertami w naszej bazie.
          </p>
        </>
      )}
    </div>
  );
}
