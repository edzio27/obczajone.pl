import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ListingCard } from '@/components/listing-card';
import { fetchBiggestPriceDrops } from '@/lib/home-data';

export const metadata: Metadata = {
  title: 'Auta, które staniały — wszystkie obniżki cen | obczajone.pl',
  description:
    'Ogłoszenia z Otomoto i Otodom, w których sprzedający zszedł z ceny, odkąd je obserwujemy. Policzone z historii cen zapisywanej codziennie przez obczajone.pl.',
  alternates: { canonical: '/obnizki' },
};

// Historia dopisuje się raz na dobę, więc częstsze przeliczanie niczego nie zmieni.
export const revalidate = 3600;

/**
 * Ile obniżek publikujemy. Dziś staniało około 125 obserwowanych ofert, a wraz
 * z przelotem po modelach ta liczba będzie rosła - limit jest bezpiecznikiem
 * przed stroną, która pewnego dnia próbowałaby wyrenderować tysiąc kafelków.
 */
const MAX_DROPS = 300;

export default async function PriceDropsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const drops = await fetchBiggestPriceDrops(supabase, MAX_DROPS);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Tu sprzedający już zszedł z ceny</h1>
            <p className="text-muted-foreground max-w-2xl">
              Oferty, w których cena spadła, odkąd je obserwujemy — od najmocniejszej
              obniżki. Ogłoszenie tego nie pokaże, bo widnieje w nim tylko cena dzisiejsza.
              A sprzedający, który raz zszedł, zwykle zejdzie jeszcze raz.
            </p>
          </div>

          {drops.length === 0 ? (
            <p className="text-muted-foreground">
              Żadna z obserwowanych ofert jeszcze nie staniała.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {drops.length} {drops.length === 1 ? 'przeceniona oferta' : 'przecenionych ofert'}
              </p>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {drops.map((listing) => (
                  <ListingCard key={listing.id} {...listing} />
                ))}
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Obniżkę liczymy od pierwszej ceny, jaką u siebie zapisaliśmy, a nie od tej,
            z jaką ogłoszenie ruszyło na Otomoto — jeśli wisiało tam wcześniej, mogło
            stanieć bardziej, niż tu widać. Pokazujemy wyłącznie oferty nadal aktywne.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
