import type { SupabaseClient } from '@supabase/supabase-js';
import { slugifyModel } from '@/lib/model-slug';

/**
 * Statystyki spadków cen dla jednego modelu, liczone z historii ogłoszeń.
 *
 * To jedyna treść w serwisie, której nie da się skopiować z Otomoto ani
 * wygenerować modelem językowym: bierze się z 9800 zapisanych stanów cen,
 * czyli z obserwacji, których nikt inny nie publikuje. Otomoto tego nie pokaże,
 * bo sprzedającym nie zależy, żeby kupujący wiedział, ile da się utargować.
 */

/**
 * Ile ogłoszeń musi mieć model, żeby w ogóle dostał stronę.
 *
 * Było 5, bo tyle wtedy dawało jakiekolwiek strony - przy 971 autach w bazie
 * wyższy próg zostawiłby ich trzy. Przelot po modelach zmienił arytmetykę:
 * przy 30 ogłoszeniach zostaje 25 stron zamiast 58, a każda mediana stoi na
 * próbce, którą da się obronić.
 *
 * To jest zamiana liczby stron na ich wiarygodność i robimy ją świadomie.
 * Strona modelu licząca medianę z siedmiu ogłoszeń wygląda tak samo jak ta
 * z trzydziestu, a mówi znacznie mniej - czytelnik nie ma jak ich odróżnić,
 * więc odróżnienie musi być po naszej stronie.
 */
export const MIN_SAMPLE_SIZE = 30;

/**
 * Ile ogłoszeń musi realnie stanieć, żeby wolno było nazwać coś "typową obniżką".
 *
 * Próg na ogłoszeniach nie wystarcza, bo staniała zwykle garstka z nich. Mediana
 * z jednego auta to nie mediana, tylko to jedno auto: Skoda Octavia pokazywała
 * "typową obniżkę 39.7%" na podstawie egzemplarza przecenionego z 33 000 na
 * 19 900 zł, przy drugim, który zszedł o 1.9%. Tak policzona liczba jest gorsza
 * niż jej brak - bo czytelnik bierze ją za regułę rynku i idzie z nią negocjować.
 *
 * Poniżej tego progu pokazujemy samo "ile z nich staniało", czyli fakt, którego
 * nie musimy uśredniać.
 */
export const MIN_DROPS_FOR_MEDIAN = 3;

export type ModelTrend = {
  brand: string;
  model: string;
  slug: string;
  /** Ile ogłoszeń tego modelu mamy w bazie. */
  sampleSize: number;
  medianPrice: number | null;
  /** Ile z nich kiedykolwiek staniało. */
  droppedCount: number;
  /**
   * Mediana obniżki wśród tych, które staniały - w procentach ceny wyjściowej.
   * `null` również wtedy, gdy staniało za mało ogłoszeń, by mediana coś znaczyła
   * (patrz MIN_DROPS_FOR_MEDIAN); `droppedCount` zostaje wtedy do pokazania.
   */
  medianDropPercent: number | null;
  /** Mediana obniżki w złotych, wśród tych, które staniały. Ten sam próg. */
  medianDropPln: number | null;
  /** Największa zaobserwowana obniżka tego modelu. */
  biggestDrop: { listingId: string; title: string; from: number; to: number } | null;
  /** Mediana liczby dni, przez które ogłoszenie wisi w serwisie. */
  medianDaysListed: number | null;
};

type ListingRow = {
  id: string;
  title: string;
  current_price: number;
  /** Pierwsza zapisana cena - kolumna, nie wynik przeglądania historii. */
  first_price: number | null;
  first_seen_at: string | null;
  last_checked_at: string | null;
  specs: { brand?: string | null; model?: string | null } | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Same adresy stron modelowych, bez liczenia statystyk.
 *
 * Sitemapa potrzebuje wyłącznie listy slugów, a `fetchModelTrends` płaci za nie
 * ściągnięciem wszystkich żywych ogłoszeń do pamięci - 29 sekund przy dzisiejszej
 * bazie, czyli więcej, niż Vercel daje funkcji na odpowiedź. Grupowanie robi
 * baza (`model_slug_stats`) i oddaje kilkadziesiąt wierszy.
 *
 * Próg zostaje tutaj, po stronie aplikacji: to decyzja o tym, od ilu ogłoszeń
 * wolno nam cokolwiek twierdzić, a nie szczegół schematu.
 */
export async function fetchModelSlugs(supabase: SupabaseClient): Promise<string[]> {
  // Ten sam snapshot co trendy - jedno źródło prawdy, więc sitemapa nie może
  // zgłosić modelu, dla którego strona nie ma danych, ani odwrotnie.
  const trends = await fetchModelTrends(supabase);
  return trends.map((t) => t.slug);
}

/**
 * Wszystkie modele, o których mamy co powiedzieć.
 *
 * Czytane z `model_trends_snapshot`, który cron przelicza o :45. Liczenie
 * w Node'ie wywaliło build 18 września: `fetchModelTrend` wołało tę funkcję
 * osobno dla każdej z 36 stron modelowych, a każde wywołanie ściągało wszystkie
 * żywe ogłoszenia - ponad 330 tysięcy wierszy w jednym budowaniu. Przy ~600
 * nowych ogłoszeniach dziennie próg został przekroczony sam z siebie.
 *
 * Mediany i progi liczy teraz `model_trends_full` w bazie, wiernie wobec tego,
 * co robił tutejszy kod. MIN_SAMPLE_SIZE i MIN_DROPS_FOR_MEDIAN zostają tu jako
 * dokumentacja decyzji - baza dostaje je jako argumenty przy przeliczaniu.
 */
export async function fetchModelTrends(supabase: SupabaseClient): Promise<ModelTrend[]> {
  const { data, error } = await supabase
    .from('model_trends_snapshot')
    .select('trends')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    console.error('Nie udało się odczytać trendów modeli:', error?.message);
    return [];
  }

  const rows = (data.trends as any[]) ?? [];

  return rows.map((r) => ({
    brand: r.brand,
    model: r.model,
    slug: slugifyModel(r.brand, r.model),
    sampleSize: Number(r.sample_size),
    medianPrice: r.median_price == null ? null : Number(r.median_price),
    droppedCount: Number(r.dropped_count),
    medianDropPercent: r.median_drop_percent == null ? null : Number(r.median_drop_percent),
    medianDropPln: r.median_drop_pln == null ? null : Number(r.median_drop_pln),
    biggestDrop: r.biggest_drop_listing_id
      ? {
          listingId: r.biggest_drop_listing_id,
          title: r.biggest_drop_title || `${r.brand} ${r.model}`,
          from: Number(r.biggest_drop_from),
          to: Number(r.biggest_drop_to),
        }
      : null,
    medianDaysListed: r.median_days_listed == null ? null : Number(r.median_days_listed),
  }));
}

export async function fetchModelTrend(
  supabase: SupabaseClient,
  slug: string
): Promise<ModelTrend | null> {
  const all = await fetchModelTrends(supabase);
  return all.find((t) => t.slug === slug) ?? null;
}
