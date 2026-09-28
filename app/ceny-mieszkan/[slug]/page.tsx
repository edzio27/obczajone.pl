import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { fetchCityPrice, fetchCityPrices, MIN_CITY_LISTINGS } from '@/lib/city-prices';
import { attachPriceChanges } from '@/lib/home-data';
import { klientSerwerowy } from '@/lib/supabase-server';

export const revalidate = 3600;

type Props = { params: { slug: string } };

function client() {
  return klientSerwerowy();
}

/*
  cache() sprawia, że generateMetadata i render tej samej strony dzielą jeden
  odczyt, zamiast dwa razy iść po ten sam snapshot. Przy jedenastu miastach to
  różnica między dwudziestoma a dziesięcioma round-tripami w buildzie - a to
  właśnie ich liczba, nie ciężar pojedynczego zapytania, wywalała deploy.
*/
const getCity = cache(async (slug: string) => fetchCityPrice(client(), slug));

/*
  Pusta lista, a nie wykaz z bazy.

  Prerenderowanie tych stron przy budowaniu wiązało każdy deploy z dostępnością
  API Supabase - a ono bywa niedostępne po kilka razy dziennie. Efekt był taki,
  że w trakcie awarii nie dało się wypchnąć żadnej poprawki, łącznie z
  poprawkami samej awarii. Sprzężenie nie do utrzymania.

  `dynamicParams` zostawia trasę otwartą na każdy slug: pierwsze wejście
  renderuje i zapisuje, kolejne idą z cache'u przez `revalidate`. Strony
  powstają więc tak samo, tylko na żądanie zamiast przy budowaniu - a build
  przestaje potrzebować bazy.

  Ten sam zabieg co na /listing/[id], zastosowany tam wcześniej i z tego samego
  powodu.
*/
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await getCity(params.slug);
  if (!city) return { title: 'Nie znaleziono miasta | obczajone.pl' };

  const perM2 = city.medianPricePerM2
    ? ` Mediana ${Math.round(city.medianPricePerM2).toLocaleString('pl-PL')} zł za metr.`
    : '';

  return {
    title: `Ceny mieszkań — ${city.city} | obczajone.pl`,
    description:
      `Ile kosztuje mieszkanie w mieście ${city.city} — policzone z ${city.listings} ogłoszeń ` +
      `Otodomu obserwowanych codziennie przez obczajone.pl.${perM2}`,
    alternates: { canonical: `/ceny-mieszkan/${city.slug}` },
  };
}

function pln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold tabular mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function CityPage({ params }: Props) {
  const supabase = client();
  const city = await getCity(params.slug);
  /*
    Odsyłamy dopiero wtedy, gdy wiemy, że miasta naprawdę nie ma.

    Samo `!city` tego nie rozstrzyga: tak samo wygląda miasto poniżej progu
    i nieudany odczyt snapshotu. Pod ISR przekierowanie zapisuje się w cache,
    więc chwilowa awaria zamieniała stronę Krakowa w trwały redirect - i tak
    się stało 26 września. Jeśli snapshot ma jakiekolwiek miasta, brak tego
    jednego jest prawdą o danych; jeśli jest pusty, to awaria i lepiej nie
    zapisywać niczego (fetchCityPrices rzuca wtedy wyjątek wyżej).
  */
  if (!city) {
    const wszystkie = await fetchCityPrices(supabase);
    if (wszystkie.length === 0) {
      throw new Error('Snapshot cen miast jest pusty - nie zapisujemy tej strony');
    }
    redirect('/ceny-mieszkan');
  }

  const { data: rows } = await supabase
    .from('listings')
    .select(
      'id, title, location, current_price, first_price, source, created_at, image_url, ai_opinion_rating'
    )
    .eq('source', 'otodom')
    .eq('is_active', true)
    .eq('location', city.city)
    .gt('current_price', 0)
    .order('current_price', { ascending: true })
    .limit(12);

  const listings = await attachPriceChanges(supabase, rows ?? []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Link
              href="/ceny-mieszkan"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Wszystkie miasta
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-3">
              Ceny mieszkań — {city.city}
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Policzone z {city.listings} ogłoszeń Otodomu, które obserwujemy codziennie.
              To ceny ofertowe — czego żądają sprzedający, a nie po ile mieszkania
              faktycznie się sprzedają.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Mediana ceny" value={pln(city.medianPrice)} />
            <Stat
              label="Za metr"
              value={city.medianPricePerM2 != null ? pln(city.medianPricePerM2) : '—'}
            />
            <Stat
              label="Typowy metraż"
              value={city.medianArea != null ? `${city.medianArea} m²` : '—'}
            />
            <Stat
              label="Ile staniało"
              value={String(city.dropped)}
              hint={
                city.dropped === 0
                  ? 'Obserwujemy je od niedawna.'
                  : city.medianDropPercent != null
                    ? `Typowo o ${city.medianDropPercent}%`
                    : undefined
              }
            />
          </div>

          {listings.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">
                Najtańsze obserwowane oferty w mieście {city.city}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} {...listing} />
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground">
            Liczby opisują wyłącznie ogłoszenia zapisane w obczajone.pl, a nie cały rynek
            miasta. Miasto publikujemy dopiero od {MIN_CITY_LISTINGS} ogłoszeń, bo z
            mniejszej próbki mediana ceny za metr opisuje przypadek, a nie miasto.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
