import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { fetchArchivedListings, fetchArchiveStats } from '@/lib/archive-data';
import { klientSerwerowy } from '@/lib/supabase-server';
import { Suspense } from 'react';
import { ArchiveSearch } from '@/components/archive-search';

/*
  Tytuł i opis pod to, jak ludzie pytają. W Search Console (3 miesiące do
  13.10.2026) grupa „archiwum otomoto”, „otomoto archiwum (ogłoszeń)”,
  „ogłoszenia archiwalne otomoto” to ~1370 wyświetleń na pozycji 5-6 i CTR
  ~11%. Słowo „archiwalne” i obietnica wyszukania konkretnej oferty są w tych
  zapytaniach, a wcześniej nie było ich ani w tytule, ani na stronie.
*/
export const metadata: Metadata = {
  title: 'Archiwum Otomoto — wyszukaj archiwalne i zdjęte ogłoszenia z ceną | obczajone.pl',
  description:
    'Archiwalne ogłoszenia z Otomoto: wyszukaj zdjętą ofertę po marce, modelu albo linku i zobacz ostatnią cenę, historię obniżek i datę zniknięcia. Kilka tysięcy aut, przybywa codziennie.',
  alternates: { canonical: '/archiwum-otomoto' },
};

const faqs = [
  {
    question: 'Czy Otomoto ma archiwum ogłoszeń?',
    answer:
      'Tylko dla sprzedającego. Zakończone ogłoszenie zostaje przez około pół roku w archiwum jego konta, ale kupujący widzi po zdjęciu oferty już tylko pusty adres. Dlatego zapisujemy ogłoszenia, zanim znikną, razem z ceną i jej historią.',
  },
  {
    question: 'Jak zobaczyć archiwalne ogłoszenie z Otomoto?',
    answer:
      'Wpisz markę i model w wyszukiwarkę na tej stronie albo wklej link do oferty. Jeśli zdążyliśmy ją zapisać, zobaczysz ostatnią cenę, historię obniżek, zdjęcie i datę zniknięcia.',
  },
  {
    question: 'Jak otworzyć własne archiwalne ogłoszenie na Otomoto?',
    answer:
      'Zaloguj się na swoje konto Otomoto, przejdź do swoich ogłoszeń i przełącz widok na zakończone. Tam możesz je podejrzeć albo wystawić ponownie. To archiwum Twojego konta, nie nasze.',
  },
  {
    question: 'Za ile sprzedało się auto ze zdjętego ogłoszenia?',
    answer:
      'Tego nie wie nikt poza stronami transakcji. Pokazujemy ostatnią cenę z ogłoszenia i to, jak sprzedający ją obniżał. Zniknięcie oferty nie zawsze oznacza sprzedaż: ogłoszenie mogło wygasnąć albo wrócić pod nowym adresem.',
  },
  {
    question: 'Dlaczego nie ma tu ogłoszenia, którego szukam?',
    answer:
      'Archiwum obejmuje tylko oferty, które zdążyliśmy zobaczyć przed zniknięciem. Żeby następnym razem mieć historię ceny, wklej link na stronie głównej, póki ogłoszenie wisi na Otomoto — od tej chwili sprawdzamy je codziennie.',
  },
];

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
  const supabase = klientSerwerowy();

  const [listings, stats] = await Promise.all([
    fetchArchivedListings(supabase, { source: 'otomoto', limit: MAX_ARCHIVED }),
    fetchArchiveStats(supabase, { source: 'otomoto' }),
  ]);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
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

          {/* Wyszukiwarka przed wszystkim innym: po nią tu się przychodzi. Strona
              od początku zakładała, że „pełną listę przegląda się wyszukiwarką”,
              której nie było. */}
          <Suspense fallback={null}>
            <ArchiveSearch />
          </Suspense>

          {/*
            Rozróżnienie dwóch intencji, zaraz pod wyszukiwarką.

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

          <section aria-labelledby="pytania-archiwum" className="space-y-4">
            <h2 id="pytania-archiwum" className="text-xl font-bold">Najczęstsze pytania</h2>
            {faqs.map((f) => (
              <div key={f.question}>
                <h3 className="font-semibold">{f.question}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
              </div>
            ))}
          </section>

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
