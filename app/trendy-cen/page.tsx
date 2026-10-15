import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, TrendingDown, Info } from 'lucide-react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceIndexChart } from '@/components/market/price-index-chart';
import { fetchMarketTrends, type TrendGroup } from '@/lib/market-trends';
import { fetchModelSlugs } from '@/lib/price-trends';
import { slugifyModel } from '@/lib/model-slug';
import { largePhotoUrl } from '@/lib/photo-url';
import { klientSerwerowy } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Trendy cen używanych aut na Otomoto — czy ceny spadają? | obczajone.pl',
  description:
    'Jak zmieniają się ceny używanych aut na Otomoto: indeks cen tych samych egzemplarzy tydzień po tygodniu, marki i modele, które tanieją najszybciej, oraz auta, które właśnie potaniały.',
  alternates: { canonical: '/trendy-cen' },
};

// Dane liczy nocny cron, godzina wystarcza z zapasem.
export const revalidate = 3600;

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function formatChange(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function changeTone(value: number): string {
  if (value <= -0.5) return 'text-success';
  if (value >= 0.5) return 'text-warning';
  return 'text-muted-foreground';
}

function groupName(g: TrendGroup): string {
  if (g.kind === 'model') return `${g.brand} ${g.model}`;
  if (g.kind === 'make') return g.brand ?? '';
  return g.body ?? '';
}

function RankingCard({
  title,
  groups,
  modelSlugs,
}: {
  title: string;
  groups: TrendGroup[];
  modelSlugs: Set<string>;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2.5">
          {groups.map((g, i) => {
            const slug = g.kind === 'model' && g.brand && g.model ? slugifyModel(g.brand, g.model) : null;
            const name = groupName(g);
            return (
              <li key={name} className="flex items-baseline justify-between gap-3">
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  {slug && modelSlugs.has(slug) ? (
                    <Link href={`/ile-spada-cena/${slug}`} className="truncate font-medium hover:text-primary">
                      {name}
                    </Link>
                  ) : (
                    <span className="truncate font-medium">{name}</span>
                  )}
                </span>
                <span className={`font-semibold tabular-nums ${changeTone(g.change30Percent)}`}>
                  {formatChange(g.change30Percent)}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function GroupTable({ caption, groups }: { caption: string; groups: TrendGroup[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{caption}</th>
            <th className="px-4 py-3 font-medium text-right">Mediana ceny</th>
            <th className="px-4 py-3 font-medium text-right">Zmiana w 30 dni</th>
            <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Zmieniło cenę</th>
            <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Ogłoszeń</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={groupName(g)} className="border-t">
              <td className="px-4 py-3 font-medium">{groupName(g)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {g.medianPrice != null ? formatPln(g.medianPrice) : '—'}
              </td>
              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${changeTone(g.change30Percent)}`}>
                {formatChange(g.change30Percent)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                {Math.round(g.changedSharePercent)}%
              </td>
              <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                {g.active?.toLocaleString('pl-PL') ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const faqs = [
  {
    question: 'Czy ceny używanych aut spadają?',
    answer:
      'Ceny ofertowe na Otomoto powoli schodzą w dół. Ten sam samochód kosztuje dziś zwykle mniej niż tydzień czy miesiąc temu, bo sprzedający obniżają cenę, gdy auto nie schodzi. Aktualną liczbę pokazujemy na górze strony.',
  },
  {
    question: 'Jak liczycie zmianę cen?',
    answer:
      'Na tych samych egzemplarzach. Auto wchodzi do pomiaru tylko wtedy, gdy znamy jego cenę na początku i na końcu okresu, więc dołożenie do bazy droższych albo tańszych modeli nie zmienia wyniku. To ceny ofertowe z Otomoto, nie ceny transakcyjne.',
  },
  {
    question: 'Ile można utargować na używanym aucie?',
    answer:
      'Mniej więcej co trzecie do co drugiego ogłoszenia zmienia cenę w ciągu miesiąca. Typowe obniżki dla popularnych modeli pokazujemy na stronach „Ile spada cena”, a przy każdym ogłoszeniu podpowiadamy kwotę na start rozmowy.',
  },
  {
    question: 'Skąd macie dane?',
    answer:
      'Codziennie sprawdzamy ceny ogłoszeń z Otomoto i zapisujemy każdą zmianę. Popularne auta sprawdzamy średnio co kilka dni, a te, które ktoś u nas oglądał, codziennie.',
  },
];

export default async function MarketTrendsPage() {
  const supabase = klientSerwerowy();
  const [trends, modelSlugList] = await Promise.all([
    fetchMarketTrends(supabase),
    fetchModelSlugs(supabase),
  ]);
  const modelSlugs = new Set(modelSlugList);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  if (!trends || trends.index.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="container mx-auto px-4 py-10 flex-1">
          <h1 className="text-3xl font-bold">Trendy cen używanych aut</h1>
          <p className="mt-3 text-muted-foreground">Przeliczamy dane. Zajrzyj za chwilę.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const overall = trends.groups.find((g) => g.kind === 'all') ?? null;
  const bodies = trends.groups
    .filter((g) => g.kind === 'body')
    .sort((a, b) => (b.active ?? 0) - (a.active ?? 0));
  const makes = trends.groups
    .filter((g) => g.kind === 'make')
    .sort((a, b) => (a.brand ?? '').localeCompare(b.brand ?? '', 'pl'));
  const models = trends.groups.filter((g) => g.kind === 'model');
  const byChange = (list: TrendGroup[]) => [...list].sort((a, b) => a.change30Percent - b.change30Percent);

  // Zmiana indeksu za ostatnie 4 tygodnie (albo od startu, jeśli pomiarów jest mniej).
  const last = trends.index[trends.index.length - 1];
  const base = trends.index.length > 4 ? trends.index[trends.index.length - 5].value : 100;
  const indexChange4w = ((last.value - base) / base) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-5xl mx-auto space-y-12">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Trendy cen</p>
            <h1 className="mt-2 text-3xl md:text-5xl font-extrabold text-balance">
              Ceny używanych aut:{' '}
              <span className={changeTone(indexChange4w)}>{formatChange(indexChange4w)}</span> w ostatnich 4
              tygodniach
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
              Codziennie sprawdzamy ceny ogłoszeń z Otomoto i zapisujemy każdą zmianę. Tutaj widać,
              co z tego wynika dla całego rynku: czy ceny tych samych aut idą w dół, które marki
              i modele tanieją najszybciej i które auta właśnie potaniały.
            </p>

            {overall && (
              <dl className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border p-5">
                  <dt className="text-xs text-muted-foreground">Auta wystawione co najmniej 30 dni temu</dt>
                  <dd className={`mt-1 text-3xl font-extrabold ${changeTone(overall.change30Percent)}`}>
                    {formatChange(overall.change30Percent)}
                  </dd>
                  <dd className="text-xs text-muted-foreground mt-1">średnia zmiana ceny przez ten miesiąc</dd>
                </div>
                <div className="rounded-xl border p-5">
                  <dt className="text-xs text-muted-foreground">Sprzedający, którzy zmienili cenę</dt>
                  <dd className="mt-1 text-3xl font-extrabold">{Math.round(overall.changedSharePercent)}%</dd>
                  <dd className="text-xs text-muted-foreground mt-1">w ciągu ostatnich 30 dni</dd>
                </div>
                <div className="rounded-xl border p-5">
                  <dt className="text-xs text-muted-foreground">Mediana ceny auta w ogłoszeniu</dt>
                  <dd className="mt-1 text-3xl font-extrabold">
                    {overall.medianPrice != null ? formatPln(overall.medianPrice) : '—'}
                  </dd>
                  <dd className="text-xs text-muted-foreground mt-1">
                    z {overall.active?.toLocaleString('pl-PL')} aktywnych ogłoszeń, które śledzimy
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section aria-labelledby="indeks">
            <h2 id="indeks" className="text-2xl font-bold">Indeks cen tych samych aut</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              100 to pierwszy tydzień pomiarów. Co tydzień porównujemy ceny aut, które były
              wystawione na początku i na końcu tygodnia, więc wynik nie zależy od tego, jakie
              modele akurat dołożyliśmy do bazy.
            </p>
            <Card className="mt-4">
              <CardContent className="pt-6">
                <PriceIndexChart points={trends.index} />
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="rankingi">
            <h2 id="rankingi" className="text-2xl font-bold">Co tanieje najszybciej</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Zmiana ceny tych samych aut w ostatnich 30 dniach. Pokazujemy marki i modele z co
              najmniej 30 autami w pomiarze.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <RankingCard title="Marki, które tanieją" groups={byChange(makes).slice(0, 5)} modelSlugs={modelSlugs} />
              <RankingCard title="Modele, które tanieją" groups={byChange(models).slice(0, 5)} modelSlugs={modelSlugs} />
              <RankingCard
                title="Marki, które trzymają cenę"
                groups={byChange(makes).reverse().slice(0, 5)}
                modelSlugs={modelSlugs}
              />
              <RankingCard
                title="Modele, które trzymają cenę"
                groups={byChange(models).reverse().slice(0, 5)}
                modelSlugs={modelSlugs}
              />
            </div>
          </section>

          {trends.recentDrops.length > 0 && (
            <section aria-labelledby="potanialy">
              <h2 id="potanialy" className="flex items-center gap-2 text-2xl font-bold">
                <TrendingDown className="h-6 w-6 text-success" />
                Potaniały w tym tygodniu
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Aktywne ogłoszenia, przy których zauważyliśmy największą obniżkę w ostatnich 7 dniach.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trends.recentDrops.map((d) => {
                  const percent = ((d.toPrice - d.fromPrice) / d.fromPrice) * 100;
                  return (
                    <Link
                      key={d.id}
                      href={`/listing/${d.id}`}
                      className="group overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
                    >
                      <div className="aspect-[4/3] bg-muted">
                        {d.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={largePhotoUrl(d.imageUrl)}
                            alt={d.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-semibold truncate">{d.title}</p>
                        <p className="mt-1 flex items-baseline gap-2">
                          <span className="text-lg font-bold">{formatPln(d.toPrice)}</span>
                          <span className="text-sm text-muted-foreground line-through">{formatPln(d.fromPrice)}</span>
                          <span className="ml-auto font-semibold text-success">{formatChange(percent)}</span>
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {bodies.length > 0 && (
            <section aria-labelledby="nadwozie">
              <h2 id="nadwozie" className="text-2xl font-bold">Według typu nadwozia</h2>
              <div className="mt-4">
                <GroupTable caption="Nadwozie" groups={bodies} />
              </div>
            </section>
          )}

          {makes.length > 0 && (
            <section aria-labelledby="marki">
              <h2 id="marki" className="text-2xl font-bold">Według marki</h2>
              <div className="mt-4">
                <GroupTable caption="Marka" groups={makes} />
              </div>
              <Link
                href="/ile-spada-cena"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all"
              >
                Ile spada cena konkretnego modelu
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          )}

          <section aria-labelledby="pytania">
            <h2 id="pytania" className="text-2xl font-bold">Najczęstsze pytania</h2>
            <div className="mt-4 space-y-4">
              {faqs.map((f) => (
                <div key={f.question}>
                  <h3 className="font-semibold">{f.question}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Ceny ofertowe z Otomoto, nie transakcyjne. Pomiary od września 2026, przeliczane co
              noc. Zmianę ceny przypisujemy do dnia, w którym ją zauważyliśmy. Odczyty, w których
              cena zmieniła się ponad trzykrotnie, odrzucamy jako błędy ogłoszeń.
            </span>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
