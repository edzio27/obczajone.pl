import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { VinCheckCta } from '@/components/vin-check-cta';
import { fetchCityPrice, fetchCityPrices, MIN_CITY_LISTINGS } from '@/lib/city-prices';
import { attachPriceChanges } from '@/lib/home-data';

export const revalidate = 3600;

type Props = { params: { slug: string } };

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function generateStaticParams() {
  const cities = await fetchCityPrices(client());
  return cities.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = await fetchCityPrice(client(), params.slug);
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
  const city = await fetchCityPrice(supabase, params.slug);
  if (!city) notFound();

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

          <VinCheckCta context="model_page" />

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
