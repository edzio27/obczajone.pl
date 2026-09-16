import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import {
  fetchModelReport,
  fetchReport,
  REPORT_MIN_DAYS,
  REPORT_MIN_SAMPLE,
} from '@/lib/report-data';

export const metadata: Metadata = {
  title: 'Ile realnie schodzą sprzedający aut — dane dla mediów | obczajone.pl',
  description:
    'Co piąte auto obserwowane co najmniej dwa tygodnie tanieje, zanim znajdzie kupca. Dane z 32 tysięcy pomiarów cen ogłoszeń Otomoto, z metodologią i zgodą na cytowanie.',
  alternates: { canonical: '/dla-mediow' },
};

/*
  Liczby przelicza cron o :35 i zapisuje do report_snapshot; ta strona czyta
  jeden wiersz. Godzina odświeżania zgrywa się z tamtym harmonogramem.
*/
export const revalidate = 3600;

function pln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function Figure({
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
        <p className="text-3xl font-extrabold tabular text-primary">{value}</p>
        <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function PressPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [report, models] = await Promise.all([
    fetchReport(supabase),
    fetchModelReport(supabase),
  ]);

  const cars = report?.otomoto ?? null;
  const flats = report?.otodom ?? null;

  /*
    Data przeliczenia, a nie dzisiejsza. Strona, która pod każdą datą pokazuje
    te same liczby, myli cytującego - a tu liczby zmieniają się o :35.
  */
  const computedAt = report?.computedAt
    ? new Date(report.computedAt).toLocaleString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  /*
    Najgłębsza i najpłytsza obniżka wśród modeli - to jest zdanie, dla którego
    dziennikarz bierze ten materiał. Model, przy którym "zawsze da się coś
    urwać", nie jest tym, przy którym warto twardo negocjować, i widać to
    dopiero, gdy postawi się częstość obok głębokości.
  */
  const withMedian = models.filter((m) => m.medianDropPln != null);
  const deepest = withMedian.reduce<typeof withMedian[number] | null>(
    (best, m) => (best == null || m.medianDropPct! > best.medianDropPct! ? m : best),
    null
  );
  const mostFrequent = models.reduce<typeof models[number] | null>(
    (best, m) => (best == null || m.droppedPct > best.droppedPct ? m : best),
    null
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Dane dla mediów{computedAt ? ` · stan na ${computedAt}` : ''}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-4">
              Ile realnie schodzą sprzedający aut używanych
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Od {report?.observedDays ?? 177} dni zapisujemy codziennie ceny tych samych ogłoszeń
              z Otomoto i Otodomu. Powstaje z tego historia negocjacji widziana od strony
              sprzedającego — kiedy zszedł z ceny, o ile i ile razy. Ogłoszenie tego nie pokaże,
              bo widnieje w nim tylko cena dzisiejsza.
            </p>
          </div>

          {/*
            Gdy liczb nie ma, mówimy to wprost.

            Wcześniej sekcja po prostu znikała i strona szła dalej jak gdyby nigdy
            nic - materiał prasowy bez ani jednej liczby, za to wyglądający na
            kompletny. Dziennikarz nie ma jak poznać, że czegoś brakuje, więc musi
            mu to powiedzieć strona.
          */}
          {!cars && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Liczby przeliczają się w tej chwili i za moment tu wrócą. Jeśli potrzebujesz
                  ich teraz, napisz na{' '}
                  <a href="mailto:kontakt@obczajone.pl" className="underline underline-offset-4">
                    kontakt@obczajone.pl
                  </a>{' '}
                  — odeślemy zestawienie tego samego dnia.
                </p>
              </CardContent>
            </Card>
          )}

          {cars && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Figure
                value={`${cars.droppedPct}%`}
                label="ofert obniżyło cenę"
                hint={`Spośród ${cars.watched.toLocaleString('pl-PL')} obserwowanych co najmniej ${REPORT_MIN_DAYS} dni.`}
              />
              <Figure
                value={cars.medianDropPln != null ? pln(cars.medianDropPln) : '—'}
                label="mediana obniżki"
                hint={
                  cars.medianDropPct != null
                    ? `${cars.medianDropPct}% ceny wyjściowej.`
                    : undefined
                }
              />
              <Figure
                value={cars.multiDrop.toLocaleString('pl-PL')}
                label="aut obniżyło cenę więcej niż raz"
                hint="Niektóre trzy i cztery razy."
              />
              <Figure
                value={(report?.snapshots ?? 0).toLocaleString('pl-PL')}
                label="zapisanych stanów ceny"
                hint="Obie platformy razem."
              />
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Dlaczego dwa tygodnie, a nie cała baza</h2>
            <p className="text-muted-foreground max-w-2xl">
              W całej bazie cenę obniżyło niecałe 13% aut — ale połowa ofert przewija się przez
              nasze pomiary w niespełna sześć dni, czyli za krótko, żeby ktokolwiek zdążył się
              rozmyślić. Taka liczba mierzy głównie to, jak długo patrzyliśmy. Na ofertach
              obserwowanych co najmniej {REPORT_MIN_DAYS} dni odsetek rośnie do{' '}
              <strong className="text-foreground">{cars?.droppedPct ?? 20}%</strong> i to ta liczba
              opisuje rynek.
            </p>
          </section>

          {models.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Rozbicie na modele</h2>
              {deepest && mostFrequent && deepest.name !== mostFrequent.name && (
                <p className="text-muted-foreground max-w-2xl">
                  Ciekawsza od częstości jest głębokość.{' '}
                  <strong className="text-foreground">{mostFrequent.name}</strong> tanieje
                  najczęściej ({mostFrequent.droppedPct}% ofert), ale płytko — mediana{' '}
                  {mostFrequent.medianDropPln != null ? pln(mostFrequent.medianDropPln) : '—'}.{' '}
                  <strong className="text-foreground">{deepest.name}</strong> schodzi rzadziej
                  ({deepest.droppedPct}%), za to o {pln(deepest.medianDropPln!)}, czyli{' '}
                  {deepest.medianDropPct}% ceny wyjściowej. Model, przy którym „zawsze da się coś
                  urwać", nie musi być tym, przy którym warto twardo negocjować.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-4 font-semibold">Model</th>
                      <th className="py-2 pr-4 font-semibold text-right">Obserwowanych</th>
                      <th className="py-2 pr-4 font-semibold text-right">Staniało</th>
                      <th className="py-2 pr-4 font-semibold text-right">Mediana obniżki</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m) => (
                      <tr key={m.name} className="border-b border-border/60">
                        <td className="py-2 pr-4">{m.name}</td>
                        <td className="py-2 pr-4 text-right tabular text-muted-foreground">
                          {m.watched}
                        </td>
                        <td className="py-2 pr-4 text-right tabular">{m.droppedPct}%</td>
                        <td className="py-2 pr-4 text-right tabular">
                          {m.medianDropPln != null ? pln(m.medianDropPln) : '—'}
                          {m.medianDropPct != null && (
                            <span className="text-muted-foreground">
                              {' '}
                              ({m.medianDropPct}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground max-w-2xl">
                Pokazujemy modele, których obserwowaliśmy co najmniej {REPORT_MIN_SAMPLE} sztuk
                przez minimum {REPORT_MIN_DAYS} dni. Przy takich liczebnościach różnice między
                sąsiednimi pozycjami nie są istotne statystycznie — to obraz rozrzutu, nie ranking.
              </p>
            </section>
          )}

          {flats && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Mieszkania: jeszcze za wcześnie</h2>
              <p className="text-muted-foreground max-w-2xl">
                Ogłoszenia z Otodomu obserwujemy krócej i na mniejszą skalę. Wśród tych, które
                wisiały u nas co najmniej {REPORT_MIN_DAYS} dni, cenę obniżyło{' '}
                <strong className="text-foreground">{flats.droppedPct}%</strong> — ale takich ofert
                jest dopiero {flats.watched}. To za mało, żeby cokolwiek twierdzić o rynku
                mieszkaniowym, i podajemy tę liczbę wyłącznie jako wstępną.
              </p>
            </section>
          )}

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-xl font-bold">Metodologia</h2>
              <dl className="grid sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="font-semibold text-foreground">Źródło</dt>
                <dd className="text-muted-foreground">
                  Ogłoszenia Otomoto i Otodom obserwowane przez obczajone.pl, sprawdzane raz na dobę.
                </dd>

                <dt className="font-semibold text-foreground">Obniżka</dt>
                <dd className="text-muted-foreground">
                  Różnica między pierwszą ceną, jaką zapisaliśmy, a ostatnią. Nie liczymy od ceny,
                  z jaką oferta ruszyła na Otomoto — jeśli wisiała tam wcześniej, mogła stanieć
                  bardziej, niż widzimy.
                </dd>

                <dt className="font-semibold text-foreground">Mediany</dt>
                <dd className="text-muted-foreground">
                  Liczone wyłącznie wśród ofert, które faktycznie staniały.
                </dd>
              </dl>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Czego te dane nie mówią
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    To nie jest próba reprezentatywna dla polskiego rynku wtórnego — obserwujemy
                    wybrane modele i miasta, nie całe Otomoto.
                  </li>
                  <li>
                    Zniknięcie ogłoszenia nie oznacza sprzedaży. Oferta wygasa też wtedy, gdy nie
                    została przedłużona albo wróciła pod innym adresem.
                  </li>
                  <li>
                    Nie znamy ceny transakcyjnej. Mierzymy cenę ofertową — to, czego sprzedający
                    żądał, a nie to, co ostatecznie dostał.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <section className="border-t-2 border-foreground pt-6 space-y-3">
            <h2 className="text-xl font-bold">Warunki wykorzystania</h2>
            <p className="text-muted-foreground max-w-2xl">
              Wszystkie liczby można cytować bez pytania o zgodę, pod warunkiem wskazania źródła
              jako <strong className="text-foreground">obczajone.pl</strong> z odnośnikiem do{' '}
              <Link href="/" className="underline underline-offset-4">
                obczajone.pl
              </Link>
              . Chętnie przygotujemy rozbicie dla konkretnego modelu, segmentu cenowego albo
              miasta — dane są nasze i mamy do nich pełny dostęp.
            </p>
            <p className="text-sm text-muted-foreground">
              Kontakt:{' '}
              <a href="mailto:kontakt@obczajone.pl" className="underline underline-offset-4">
                kontakt@obczajone.pl
              </a>
              . Liczby na tej stronie przeliczają się automatycznie — cytując, warto podać datę.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
