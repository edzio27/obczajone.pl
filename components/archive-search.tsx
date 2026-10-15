'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ListingCard } from '@/components/listing-card';
import { supabase } from '@/lib/supabase';
import { searchArchive } from '@/lib/archive-search';
import type { HomeListing } from '@/lib/home-data';

function ogloszen(n: number): string {
  if (n === 1) return 'ogłoszenie';
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'ogłoszenia' : 'ogłoszeń';
}

const POPULAR = ['Audi', 'BMW', 'Volkswagen', 'Skoda', 'Toyota', 'Ford', 'Opel', 'Mercedes-Benz', 'Volvo'];

/** Identyfikator oferty Otomoto z wklejonego linku, np. „ID6I2KY4”. */
function otomotoIdFrom(text: string): string | null {
  const match = text.match(/-ID([0-9A-Za-z]+)\.html/) ?? text.match(/^ID([0-9A-Za-z]{5,})$/);
  return match ? match[1] : null;
}

/**
 * Wyszukiwarka zdjętych ogłoszeń.
 *
 * Ludzie trafiają na archiwum z dwoma pytaniami: „mam link do oferty, która
 * zniknęła” i „szukam, za ile wystawiano takie auto”. Pierwsze obsługujemy
 * wklejonym linkiem (szukamy po identyfikatorze oferty), drugie słowami
 * z tytułu. Fraza ląduje w adresie (?q=), więc wynik da się podlinkować -
 * korzystają z tego strony modeli i strona „nie zdążyliśmy zapisać”.
 */
export function ArchiveSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('q') ?? '';

  const [query, setQuery] = useState(initial);
  const [active, setActive] = useState(initial);
  const [results, setResults] = useState<HomeListing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFoundLink, setNotFoundLink] = useState(false);

  useEffect(() => {
    const phrase = active.trim();
    setNotFoundLink(false);
    if (phrase.length < 2) {
      setResults(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const id = otomotoIdFrom(phrase);
      if (id) {
        const { data } = await supabase
          .from('listings')
          .select('id')
          .eq('source', 'otomoto')
          .eq('listing_id', id)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          router.push(`/listing/${data.id}`);
          return;
        }
        setNotFoundLink(true);
        setResults([]);
        setLoading(false);
        return;
      }

      const found = await searchArchive(supabase, phrase).catch(() => []);
      if (cancelled) return;
      setResults(found);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, router]);

  function submit(phrase: string) {
    setQuery(phrase);
    setActive(phrase);
    const url = phrase.trim() ? `/archiwum-otomoto?q=${encodeURIComponent(phrase.trim())}` : '/archiwum-otomoto';
    window.history.replaceState(null, '', url);
  }

  return (
    <section aria-labelledby="szukaj-w-archiwum" className="space-y-4">
      <h2 id="szukaj-w-archiwum" className="text-xl font-bold">
        Szukaj w archiwum
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Marka i model, np. Skoda Octavia, albo link do oferty"
            className="pl-9 h-11"
            aria-label="Szukaj w archiwum ogłoszeń Otomoto"
          />
          {query && (
            <button
              type="button"
              onClick={() => submit('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Wyczyść"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Szukaj
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {POPULAR.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => submit(brand)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              active.toLowerCase() === brand.toLowerCase()
                ? 'border-primary bg-primary/10 text-primary'
                : 'hover:bg-muted'
            }`}
          >
            {brand}
          </button>
        ))}
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Szukam…
        </p>
      )}

      {!loading && notFoundLink && (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Tej oferty nie mamy w archiwum.</p>
          <p className="mt-1 text-muted-foreground">
            Zapisujemy tylko ogłoszenia, które zdążyliśmy zobaczyć, zanim zniknęły z Otomoto.
            Wpisz markę i model, żeby zobaczyć podobne auta, które mamy.
          </p>
        </div>
      )}

      {!loading && results && !notFoundLink && (
        <>
          <p className="text-sm text-muted-foreground">
            {results.length === 0
              ? `Nic nie znaleźliśmy dla „${active}”. Spróbuj samej marki albo modelu.`
              : `${results.length === 24 ? 'Najnowsze 24' : results.length} ${ogloszen(results.length)} dla „${active}”`}
          </p>
          {results.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {results.map((listing) => (
                <ListingCard key={listing.id} {...listing} isArchived />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
