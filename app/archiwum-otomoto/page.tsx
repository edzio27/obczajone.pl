import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { fetchArchivedListings, fetchArchiveStats } from '@/lib/archive-data';

export const metadata: Metadata = {
  title: 'Archiwum ogłoszeń Otomoto — zdjęte oferty i historia cen | obczajone.pl',
  description:
    'Ogłoszenia z Otomoto, których już tam nie ma: ostatnia cena, historia obniżek i data zniknięcia. Po zdjęciu oferty jej strona znika z serwisu — u nas zostaje.',
  alternates: { canonical: '/archiwum-otomoto' },
};

// Archiwum przyrasta po każdym przelocie, ale nie szybciej niż raz na godzinę.
export const revalidate = 3600;

/**
 * Ile zdjętych ofert pokazujemy.
 *
 * Strona ma być wejściem do archiwum, nie jego wydrukiem: interesuje nas, żeby
 * Google miał skąd zejść do pojedynczych ogłoszeń, a czytelnik żeby zobaczył,
 * czym to archiwum w ogóle jest. Pełną listę i tak przegląda się wyszukiwarką.
 */
const MAX_ARCHIVED = 60;

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-extrabold tabular">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function OtomotoArchivePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [listings, stats] = await Promise.all([
    fetchArchivedListings(supabase, { source: 'otomoto', limit: MAX_ARCHIVED }),
    fetchArchiveStats(supabase, { source: 'otomoto' }),
  ]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Archiwum ogłoszeń Otomoto</h1>
            <p className="text-muted-foreground max-w-2xl">
              Oferty, których na Otomoto już nie ma. Kiedy sprzedający zdejmie ogłoszenie,
              jego strona przestaje być dostępna i zostaje po niej pusty adres — a my
              zapisaliśmy cenę, opis i to, jak ta cena zmieniała się, zanim auto zniknęło.
            </p>
          </div>

          {/*
            Rozróżnienie dwóch intencji, i to na samej górze.

            Wyniki wyszukiwania na "archiwum otomoto" prowadzą dziś do pomocy
            Otomoto i do poradników "jak otworzyć archiwalne ogłoszenie" - bo
            większość pytających to sprzedający, który szuka WŁASNEJ oferty na
            swoim koncie. Nasza strona odpowiada na inne pytanie, i to widać
            w danych: 628 wyświetleń przy CTR 4.6%, czyli ludzie nas widzą
            i nie klikają.

            Człowiek, który trafił tu po swoje ogłoszenie, ma dostać odpowiedź
            od razu, nawet jeśli to odpowiedź "to jest u nich, nie u nas".
            Odesłanie go jednym zdaniem jest uczciwsze niż przetrzymywanie go
            na stronie, która mu nie pomoże.
          */}
          <Card>
            <CardContent className="pt-6 space-y-2 text-sm">
              <p className="font-medium text-foreground">
                Szukasz własnego ogłoszenia, które wystawiałeś na Otomoto?
              </p>
              <p className="text-muted-foreground">
                Tego tutaj nie znajdziesz. Otomoto trzyma zakończone ogłoszenia przez pół roku
                w archiwum Twojego konta — wejdź na swoje konto, do sekcji z ogłoszeniami,
                i przełącz widok na zakończone. Po tym czasie oferta znika także stamtąd.
              </p>
              <p className="text-muted-foreground">
                Ta strona jest o czymś innym: zbieramy <strong className="text-foreground font-medium">cudze</strong>{' '}
                ogłoszenia, zanim znikną, żeby dało się sprawdzić, za ile ostatecznie
                wystawiano auto, którego już nie ma w serwisie.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              value={stats.total.toLocaleString('pl-PL')}
              label="zdjętych ogłoszeń w archiwum"
              hint="Każde z zapisaną ceną i datą zniknięcia."
            />
            <Stat
              value={stats.dropped.toLocaleString('pl-PL')}
              label="staniało, zanim zniknęło"
              hint="Sprzedający zszedł z ceny, a i tak nie sprzedał od razu."
            />
            <Stat
              value={
                stats.medianDropPercent != null
                  ? `${stats.medianDropPercent.toFixed(1)}%`
                  : 'za mało danych'
              }
              label="typowa obniżka wśród nich"
              hint="Mediana, liczona od pierwszej ceny, jaką u siebie zapisaliśmy."
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Ostatnio zniknęły z Otomoto</h2>
            {listings.length === 0 ? (
              <p className="text-muted-foreground">
                Żadna z obserwowanych ofert jeszcze nie zniknęła.
              </p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} {...listing} isArchived />
                ))}
              </div>
            )}
          </div>

          <Card>
            <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Czego tu nie ma</p>
              <p>
                To nie jest kopia całego Otomoto. Archiwum obejmuje wyłącznie ogłoszenia,
                które zdążyliśmy zobaczyć, zanim zniknęły — a obserwujemy wybrane modele,
                nie cały serwis. Jeśli szukasz konkretnej oferty i nie ma jej tutaj,
                najprawdopodobniej nigdy jej nie widzieliśmy.
              </p>
              <p>
                Zniknięcie ogłoszenia nie znaczy, że auto się sprzedało. Oferta wygasa też
                wtedy, gdy sprzedający jej nie przedłużył albo wystawił ją na nowo pod innym
                adresem — i wtedy cena bywa inna niż ostatnia, którą tu widać.
              </p>
              <p>
                Szukasz raczej tego, ile da się utargować?{' '}
                <Link href="/ile-spada-cena" className="underline underline-offset-4">
                  Zobacz, o ile schodzą sprzedający model po modelu
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
