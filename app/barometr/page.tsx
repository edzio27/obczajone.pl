import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { ModelDropsChart, DropDistributionChart } from '@/components/barometer-charts';
import { fetchBarometer } from '@/lib/barometer-data';

export const metadata: Metadata = {
  title: 'Barometr obniżek — ile naprawdę schodzą sprzedający | obczajone.pl',
  description:
    'Ile procent ofert samochodowych tanieje i o ile — policzone z cen zapisywanych codziennie przez obczajone.pl. Ranking modeli, rozkład obniżek i opis metody.',
  alternates: { canonical: '/barometr' },
};

export const revalidate = 3600;

function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-3xl md:text-4xl font-extrabold tabular">{value}</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function BarometerPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { overview, byModel, distribution } = await fetchBarometer(supabase);

  const biggest = byModel[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-2.5">
              Barometr obniżek
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Ile naprawdę schodzą sprzedający
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Codziennie zapisujemy ceny ogłoszeń z Otomoto i Otodomu. To, co poniżej,
              wynika wprost z tych zapisów — nie z ankiet, deklaracji ani cen
              wywoławczych. Ogłoszenie pokazuje tylko cenę dzisiejszą, więc tego, czy
              sprzedający już raz zszedł, nie da się z niego wyczytać.
            </p>
          </div>

          {overview && (
            <div className="grid sm:grid-cols-3 gap-4">
              <Stat
                value={`${overview.dropShare}%`}
                label="ofert stanieje"
                hint={`${overview.droppedListings} z ${overview.activeListings} obserwowanych ogłoszeń jest dziś tańszych, niż gdy je zobaczyliśmy.`}
              />
              <Stat
                value={biggest ? `${biggest.medianDropPercent}%` : '—'}
                label={biggest ? `najwięcej: ${biggest.brand} ${biggest.model}` : 'brak danych'}
                hint={
                  biggest
                    ? `Typowa obniżka w tym modelu, z ${biggest.drops} przecen.`
                    : undefined
                }
              />
              <Stat
                value={String(overview.droppedListings)}
                label="przecen w bazie"
                hint="Każda policzona od pierwszej ceny, jaką u siebie zapisaliśmy, do dzisiejszej."
              />
            </div>
          )}

          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">Które modele tanieją najbardziej</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Typowa obniżka w modelu, licząc tylko te egzemplarze, które faktycznie
                staniały. Model pokazujemy dopiero od trzech przecen — z jednej nie da
                się powiedzieć nic o modelu, a tylko o tym jednym aucie. Bledszy słupek
                to mniejsza próbka.
              </p>
            </div>
            {byModel.length > 0 ? (
              <ModelDropsChart data={byModel} />
            ) : (
              <p className="text-muted-foreground">Za mało przecen, żeby cokolwiek porównywać.</p>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">Jak duże są te obniżki</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Rozkład wszystkich przecen, jakie zaobserwowaliśmy. Odpowiada na pytanie,
                które ma każdy negocjujący: czy pięć procent to dużo.
              </p>
            </div>
            <DropDistributionChart data={distribution} />
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Jak to liczymy</h2>
            <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Obniżka to różnica między pierwszą ceną, jaką zapisaliśmy, a ceną
                dzisiejszą. Jeśli ogłoszenie wisiało na Otomoto, zanim je zobaczyliśmy,
                mogło stanieć bardziej, niż tu widać — nasze liczby są więc raczej
                ostrożne niż przesadzone.
              </p>
              <p>
                Liczymy wyłącznie oferty nadal aktywne. Ogłoszenie zdjęte z serwisu ma
                cenę zamrożoną na ostatnim odczycie i z czasem ciągnęłoby statystykę w
                przeszłość.
              </p>
              {overview?.medianDaysToDrop != null && (
                <p>
                  <strong className="text-foreground">Czego jeszcze nie podajemy:</strong>{' '}
                  ile dni mija do pierwszej obniżki. W naszych danych wychodzi{' '}
                  {overview.medianDaysToDrop}, ale większość ogłoszeń obserwujemy dopiero
                  od kilku dni, więc dłuższych przecen fizycznie nie mogliśmy jeszcze
                  zobaczyć. Ta liczba opisywałaby długość naszej obserwacji, a nie
                  zachowanie sprzedających — podamy ją, gdy przestanie.
                </p>
              )}
              <p>
                Próbka to ogłoszenia, które trafiły do obczajone.pl — nie cały rynek.
                Rośnie codziennie, więc liczby będą się zmieniać.
              </p>
            </div>
          </section>

          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">
                Szukasz konkretnego modelu?{' '}
                <Link href="/ile-spada-cena" className="font-semibold text-primary hover:underline">
                  Zobacz, ile spada cena wybranego auta
                </Link>{' '}
                — z historią cen i liczbą ogłoszeń, na których to policzyliśmy.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
