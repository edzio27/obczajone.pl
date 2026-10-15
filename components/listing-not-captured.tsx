'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, ExternalLink, Search } from 'lucide-react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ListingCard } from '@/components/listing-card';
import { ListingUrlForm } from '@/components/listing-url-form';
import { supabase } from '@/lib/supabase';
import { searchArchive } from '@/lib/archive-search';
import { carNameFromListingUrl } from '@/lib/listing-url';
import type { HomeListing } from '@/lib/home-data';

/**
 * Ogłoszenie, z którego nie mamy ani jednego pola.
 *
 * Najczęściej ktoś wkleił link do oferty, która zniknęła z Otomoto, zanim
 * ktokolwiek sprawdził ją u nas - w październiku 2026 było takich ~85
 * miesięcznie i każde kończyło się pustą stroną „Ogłoszenie Otomoto, 0 zł”.
 * To są ludzie, którzy przyszli właśnie po archiwum, więc dostają uczciwą
 * odpowiedź i to, co realnie możemy dać: podobne auta, które zapisaliśmy.
 */
export function ListingNotCaptured({ url, isGone }: { url: string; isGone: boolean }) {
  const carName = carNameFromListingUrl(url);
  const [similar, setSimilar] = useState<HomeListing[]>([]);

  useEffect(() => {
    if (!carName) return;
    searchArchive(supabase, carName, 6)
      .then(setSimilar)
      .catch(() => setSimilar([]));
  }, [carName]);

  const archiveHref = carName ? `/archiwum-otomoto?q=${encodeURIComponent(carName)}` : '/archiwum-otomoto';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="rounded-2xl border bg-card p-6 md:p-8">
            <Archive className="h-10 w-10 text-muted-foreground/50" />
            <h1 className="mt-4 text-2xl md:text-3xl font-bold">
              {isGone ? 'Tego ogłoszenia nie zdążyliśmy zapisać' : 'Nie udało się pobrać tego ogłoszenia'}
            </h1>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              {isGone
                ? 'Oferta zniknęła z Otomoto, zanim ktokolwiek sprawdził ją w obczajone.pl, więc nie mamy jej ceny ani zdjęć. Otomoto nie pokazuje zdjętych ogłoszeń kupującym, a my zapisujemy tylko te, które zdążyliśmy zobaczyć.'
                : 'Otomoto nie oddało nam tej strony. Zwykle to chwilowe — spróbuj ponownie za kilka minut albo otwórz ogłoszenie bezpośrednio.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={archiveHref}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Search className="h-4 w-4" />
                {carName ? 'Szukaj podobnych w archiwum' : 'Przeszukaj archiwum Otomoto'}
              </Link>
              {!isGone && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
                >
                  Otwórz na Otomoto
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {similar.length > 0 && (
            <section aria-labelledby="podobne-w-archiwum">
              <h2 id="podobne-w-archiwum" className="text-xl font-semibold">
                Podobne auta, które zdążyliśmy zapisać
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Zdjęte z Otomoto, z ostatnią ceną i historią obniżek.
              </p>
              <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {similar.map((listing) => (
                  <ListingCard key={listing.id} {...listing} isArchived />
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border bg-muted/40 p-6">
            <h2 className="font-semibold">Następnym razem zapiszemy ją, zanim zniknie</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Wklej link, póki ogłoszenie wisi na Otomoto. Od tej chwili codziennie sprawdzamy cenę,
              a po zdjęciu oferty zostaje u nas z historią obniżek.
            </p>
            <div className="mt-4">
              <ListingUrlForm />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
