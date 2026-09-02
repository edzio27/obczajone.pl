import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { TrendingDown } from 'lucide-react';
import { fetchModelTrend, fetchModelTrends, MIN_SAMPLE_SIZE } from '@/lib/price-trends';

export const revalidate = 3600;

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function generateStaticParams() {
  const trends = await fetchModelTrends(client());
  return trends.map((trend) => ({ slug: trend.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const trend = await fetchModelTrend(client(), params.slug);
  if (!trend) return { title: 'Nie znaleziono modelu | obczajone.pl' };

  const name = `${trend.brand} ${trend.model}`;
  const drop =
    trend.medianDropPercent != null
      ? `Typowa obniżka to ${trend.medianDropPercent.toFixed(1)}%.`
      : '';

  return {
    title: `Ile spada cena ${name} na Otomoto — dane z ${trend.sampleSize} ogłoszeń | obczajone.pl`,
    description: `Jak często sprzedający obniżają cenę ${name}, o ile i po jakim czasie. ${drop} Policzone z historii cen zapisywanej codziennie.`,
    alternates: { canonical: `/ile-spada-cena/${trend.slug}` },
  };
}

export default async function ModelTrendPage({ params }: { params: { slug: string } }) {
  const supabase = client();
  const trend = await fetchModelTrend(supabase, params.slug);

  if (!trend) notFound();

  const { data } = await supabase
    .from('listings')
    .select('id, title, current_price, location, image_url, source, created_at')
    .eq('specs->>brand', trend.brand)
    .eq('specs->>model', trend.model)
    .gt('current_price', 0)
    .order('created_at', { ascending: false })
    .limit(12);

  const listings = (data as any[]) || [];
  const name = `${trend.brand} ${trend.model}`;
  const dropShare = Math.round((trend.droppedCount / trend.sampleSize) * 100);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Link
              href="/ile-spada-cena"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              ← Wszystkie modele
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-3">
              Ile spada cena — {name}
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Policzone z {trend.sampleSize} ogłoszeń tego modelu, które obserwujemy w serwisie,
              i z zapisów ich cen z kolejnych dni.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Ogłoszeń w bazie" value={String(trend.sampleSize)} />
            <Stat
              label="Mediana ceny"
              value={trend.medianPrice != null ? formatPln(trend.medianPrice) : '—'}
            />
            <Stat
              label="Ile z nich staniało"
              value={trend.droppedCount > 0 ? `${dropShare}%` : '—'}
            />
            <Stat
              label="Typowa obniżka"
              value={
                trend.medianDropPercent != null && trend.medianDropPln != null
                  ? `${trend.medianDropPercent.toFixed(1)}%`
                  : '—'
              }
              hint={
                trend.medianDropPln != null ? `czyli ok. ${formatPln(trend.medianDropPln)}` : undefined
              }
            />
          </div>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="font-semibold text-lg">Co z tego wynika dla kupującego</h2>
              {trend.droppedCount === 0 ? (
                <p className="text-muted-foreground">
                  Żadne z obserwowanych ogłoszeń tego modelu jeszcze nie staniało. Albo trafiły
                  do nas niedawno, albo sprzedający trzymają cenę.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {dropShare}% ogłoszeń {name} w naszej bazie zostało przecenionych, a typowa
                  obniżka to{' '}
                  <strong className="text-foreground">
                    {trend.medianDropPercent?.toFixed(1)}%
                  </strong>
                  {trend.medianDropPln != null ? `, czyli ok. ${formatPln(trend.medianDropPln)}` : ''}
                  . To jest kwota, którą sprzedający tego modelu realnie oddają — więc pierwsza
                  cena z ogłoszenia rzadko jest tą ostateczną.
                  {trend.medianDaysListed != null && trend.medianDaysListed >= 1
                    ? ` Ogłoszenie wisi u nas typowo ${Math.round(trend.medianDaysListed)} dni.`
                    : ''}
                </p>
              )}

              {trend.biggestDrop && (
                <p className="text-sm flex items-start gap-2">
                  <TrendingDown className="h-4 w-4 mt-0.5 text-success shrink-0" />
                  <span>
                    Największa zaobserwowana obniżka:{' '}
                    <Link
                      href={`/listing/${trend.biggestDrop.listingId}`}
                      className="text-primary hover:underline"
                    >
                      {trend.biggestDrop.title}
                    </Link>{' '}
                    — z {formatPln(trend.biggestDrop.from)} na{' '}
                    {formatPln(trend.biggestDrop.to)}.
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          {listings.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Ogłoszenia {name}, które obserwujemy
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} {...listing} />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Liczby opisują wyłącznie ogłoszenia zapisane w obczajone.pl, a nie cały rynek.
            Model publikujemy dopiero od {MIN_SAMPLE_SIZE} ogłoszeń, bo z mniejszej próbki
            mediana nie znaczy nic.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
