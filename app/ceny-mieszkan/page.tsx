import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { CityPricesChart } from '@/components/city-prices-chart';
import { fetchCityPrices, MIN_CITY_LISTINGS } from '@/lib/city-prices';

export const metadata: Metadata = {
  title: 'Ceny mieszkań miasto po mieście — dane z ogłoszeń Otodom | obczajone.pl',
  description:
    'Mediana ceny za metr kwadratowy w największych polskich miastach, policzona z ogłoszeń Otodomu obserwowanych codziennie przez obczajone.pl.',
  alternates: { canonical: '/ceny-mieszkan' },
};

export const revalidate = 3600;

function pln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

export default async function CityPricesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const cities = await fetchCityPrices(supabase);
  const withM2 = cities.filter((c) => c.medianPricePerM2 != null);
  const dearest = [...withM2].sort((a, b) => b.medianPricePerM2! - a.medianPricePerM2!)[0];
  const cheapest = [...withM2].sort((a, b) => a.medianPricePerM2! - b.medianPricePerM2!)[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-2.5">
              Ceny mieszkań
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Ile kosztuje metr, miasto po mieście
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Mediana ceny ofertowej za metr kwadratowy, policzona z ogłoszeń Otodomu,
              które obserwujemy codziennie. To ceny, jakich chcą sprzedający — nie te,
              po których mieszkania faktycznie się sprzedają.
            </p>
          </div>

          {dearest && cheapest && dearest.city !== cheapest.city && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-3xl font-extrabold tabular">{pln(dearest.medianPricePerM2!)}</p>
                  <p className="mt-1 text-sm font-medium">za metr — najdrożej, {dearest.city}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Z {dearest.listings} obserwowanych ogłoszeń.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-3xl font-extrabold tabular">
                    {pln(cheapest.medianPricePerM2!)}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    za metr — najtaniej, {cheapest.city}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Czyli o{' '}
                    {Math.round(
                      (1 - cheapest.medianPricePerM2! / dearest.medianPricePerM2!) * 100
                    )}
                    % taniej niż w mieście powyżej.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">Mediana ceny za metr</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cena metra to jedyna liczba, którą da się uczciwie porównać między
                miastami. Mediana samej ceny ofertowej nie nadaje się do tego, bo
                w jednym mieście obserwujemy głównie kawalerki, a w innym mieszkania
                trzypokojowe.
              </p>
            </div>
            {withM2.length > 0 ? (
              <CityPricesChart data={cities} />
            ) : (
              <p className="text-muted-foreground">Jeszcze za mało danych.</p>
            )}
          </section>

          {cities.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Miasta</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {cities.map((city) => (
                  <Link key={city.slug} href={`/ceny-mieszkan/${city.slug}`}>
                    <Card className="h-full transition-colors hover:bg-muted/50">
                      <CardContent className="pt-6">
                        <h3 className="font-semibold text-lg">{city.city}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {city.listings} ogłoszeń, mediana {pln(city.medianPrice)}
                        </p>
                        {city.medianPricePerM2 != null && (
                          <p className="text-sm mt-2 font-medium">
                            {pln(city.medianPricePerM2)} / m²
                            {city.medianArea != null && (
                              <span className="font-normal text-muted-foreground">
                                {' '}
                                · typowo {city.medianArea} m²
                              </span>
                            )}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Jak to liczymy</h2>
            <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                To są <strong className="text-foreground">ceny ofertowe</strong>, czyli to,
                czego sprzedający żąda. Cena transakcyjna bywa niższa, a my jej nie widzimy —
                nikt jej publicznie nie podaje.
              </p>
              <p>
                Miasto pokazujemy dopiero od {MIN_CITY_LISTINGS} ogłoszeń. Próbka to oferty,
                które trafiły do obczajone.pl, a nie cały rynek danego miasta — rośnie
                codziennie, więc liczby będą się zmieniać.
              </p>
              <p>
                Obniżek przy mieszkaniach jest na razie garstka, bo większość tych ogłoszeń
                obserwujemy dopiero od kilku dni. Wrócimy do nich, gdy będzie co pokazywać.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
