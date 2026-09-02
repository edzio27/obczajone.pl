import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown } from 'lucide-react';
import { fetchModelTrends, MIN_SAMPLE_SIZE } from '@/lib/price-trends';

export const metadata: Metadata = {
  title: 'Ile realnie spada cena samochodu na Otomoto — dane z ogłoszeń | obczajone.pl',
  description:
    'Ile sprzedający schodzą z ceny, jak często obniżają i jak długo wisi ogłoszenie — policzone z historii cen ogłoszeń zapisywanych codziennie przez obczajone.pl.',
  alternates: { canonical: '/ile-spada-cena' },
};

// Historia dopisuje się raz na dobę, więc częstsze przeliczanie niczego nie zmieni.
export const revalidate = 3600;

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

export default async function PriceTrendsIndex() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const trends = await fetchModelTrends(supabase);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Ile realnie spada cena samochodu
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Codziennie zapisujemy ceny ogłoszeń z Otomoto. Poniżej to, co z tych zapisów
              wynika: jak często sprzedający schodzą z ceny, o ile i jak długo wisi ogłoszenie,
              zanim to zrobią. Ogłoszenie nie pokaże Ci tego, bo sprzedającemu nie zależy,
              żebyś wiedział, ile da się utargować.
            </p>
          </div>

          {trends.length === 0 ? (
            <p className="text-muted-foreground">
              Jeszcze za mało danych. Pokazujemy model dopiero od {MIN_SAMPLE_SIZE} ogłoszeń.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {trends.map((trend) => (
                <Link key={trend.slug} href={`/ile-spada-cena/${trend.slug}`}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardContent className="pt-6">
                      <h2 className="font-semibold text-lg">
                        {trend.brand} {trend.model}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {trend.sampleSize} ogłoszeń
                        {trend.medianPrice != null
                          ? `, mediana ${formatPln(trend.medianPrice)}`
                          : ''}
                      </p>
                      {trend.medianDropPercent != null && (
                        <p className="text-sm mt-2 flex items-center gap-1 text-success">
                          <TrendingDown className="h-4 w-4" />
                          Typowa obniżka {trend.medianDropPercent.toFixed(1)}%
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Liczby pochodzą wyłącznie z ogłoszeń, które mamy u siebie w bazie, i opisują tę
            próbkę — nie cały rynek. Model pokazujemy dopiero od {MIN_SAMPLE_SIZE} ogłoszeń,
            bo niżej mediana nic nie znaczy.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
