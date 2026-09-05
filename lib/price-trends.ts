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

/** Poniżej tylu ogłoszeń liczby nic nie znaczą - ten sam próg co w porównywarce cen. */
export const MIN_SAMPLE_SIZE = 5;

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
 * Wszystkie modele, o których mamy co powiedzieć.
 *
 * Jedno zapytanie po ogłoszeniach i jedno po historii cen, potem liczenie
 * w pamięci. PostgREST nie grupuje, a przy dzisiejszej skali (rzędu dwóch
 * tysięcy ogłoszeń) widok materializowany byłby aparaturą do problemu,
 * którego jeszcze nie ma.
 */
export async function fetchModelTrends(supabase: SupabaseClient): Promise<ModelTrend[]> {
  const listings: ListingRow[] = [];
  const pageSize = 1000;

  for (let from = 0; from < 10000; from += pageSize) {
    const { data } = await supabase
      .from('listings')
      .select('id, title, current_price, first_seen_at, last_checked_at, specs')
      /*
        Tylko oferty, ktore nadal stoja na Otomoto. Ogloszenie zdjete z serwisu
        ma cene zamrozona na ostatnim udanym odczycie, a liczylo sie do mediany
        na rowni z zywymi - z czasem statystyka dryfowalaby w przeszlosc,
        opisujac rynek sprzed miesiecy jako dzisiejszy.
      */
      .eq('is_active', true)
      .gt('current_price', 0)
      .range(from, from + pageSize - 1);

    const batch = (data as ListingRow[]) || [];
    listings.push(...batch);
    if (batch.length < pageSize) break;
  }

  const byModel = new Map<string, ListingRow[]>();
  for (const listing of listings) {
    const brand = listing.specs?.brand?.trim();
    const model = listing.specs?.model?.trim();
    if (!brand || !model) continue;

    const key = `${brand}|||${model}`;
    const bucket = byModel.get(key);
    if (bucket) bucket.push(listing);
    else byModel.set(key, [listing]);
  }

  // Historia cen tylko dla modeli, które i tak przejdą próg - inaczej ciągnęlibyśmy
  // dziesięć tysięcy wierszy, żeby wyrzucić większość.
  const relevant = Array.from(byModel.entries()).filter(
    ([, rows]) => rows.length >= MIN_SAMPLE_SIZE
  );
  const relevantIds = relevant.flatMap(([, rows]) => rows.map((r) => r.id));

  const firstPriceById = await fetchFirstPrices(supabase, relevantIds);

  const trends: ModelTrend[] = relevant.map(([key, rows]) => {
    const [brand, model] = key.split('|||');

    const drops: { percent: number; pln: number; listing: ListingRow; from: number }[] = [];

    for (const row of rows) {
      const firstPrice = firstPriceById.get(row.id);
      if (firstPrice == null || firstPrice <= 0) continue;

      const diff = firstPrice - row.current_price;
      if (diff <= 0) continue;

      drops.push({
        percent: (diff / firstPrice) * 100,
        pln: diff,
        listing: row,
        from: firstPrice,
      });
    }

    const biggest = drops.reduce<(typeof drops)[number] | null>(
      (best, current) => (best == null || current.pln > best.pln ? current : best),
      null
    );

    // Mediana z jednej czy dwóch obserwacji opisuje te obserwacje, nie model.
    const enoughDrops = drops.length >= MIN_DROPS_FOR_MEDIAN;

    const daysListed = rows
      .map((r) => daysBetween(r.first_seen_at, r.last_checked_at))
      .filter((d): d is number => d != null);

    return {
      brand,
      model,
      slug: slugifyModel(brand, model),
      sampleSize: rows.length,
      medianPrice: median(rows.map((r) => r.current_price)),
      droppedCount: drops.length,
      medianDropPercent: enoughDrops ? median(drops.map((d) => d.percent)) : null,
      medianDropPln: enoughDrops ? median(drops.map((d) => d.pln)) : null,
      biggestDrop: biggest
        ? {
            listingId: biggest.listing.id,
            title: biggest.listing.title || `${brand} ${model}`,
            from: biggest.from,
            to: biggest.listing.current_price,
          }
        : null,
      medianDaysListed: median(daysListed),
    };
  });

  return trends.sort((a, b) => b.sampleSize - a.sampleSize);
}

/**
 * Pierwsza zaobserwowana cena każdego ogłoszenia. To ona, a nie dzisiejsza,
 * jest punktem odniesienia dla obniżki - bo o to właśnie pyta kupujący:
 * ile ten sprzedający już zszedł.
 */
async function fetchFirstPrices(
  supabase: SupabaseClient,
  listingIds: string[]
): Promise<Map<string, number>> {
  const firstPrice = new Map<string, number>();
  const chunkSize = 50;
  /*
    PostgREST oddaje najwyżej 1000 wierszy na zapytanie i robi to po cichu -
    obcięta odpowiedź wygląda dokładnie jak kompletna. Przy 50 ogłoszeniach na
    porcję i kilku zapisach ceny na ogłoszenie zwykle się mieścimy, ale
    ogłoszenie wiszące pół roku ma ich znacznie więcej, więc każdą porcję
    dobieramy do skutku. Bez tego zgubione zapisy zaniżałyby liczbę obniżek
    i nikt by tego nie zauważył.
  */
  for (let i = 0; i < listingIds.length; i += chunkSize) {
    const chunk = listingIds.slice(i, i + chunkSize);
    const pageSize = 1000;

    for (let offset = 0; ; offset += pageSize) {
      const { data } = await supabase
        .from('listing_snapshots')
        .select('listing_id, price, scraped_at')
        .in('listing_id', chunk)
        .gt('price', 0)
        .order('scraped_at', { ascending: true })
        .range(offset, offset + pageSize - 1);

      const rows = (data as { listing_id: string; price: number }[]) || [];

      for (const row of rows) {
        if (!firstPrice.has(row.listing_id)) {
          firstPrice.set(row.listing_id, Number(row.price));
        }
      }

      if (rows.length < pageSize) break;
    }
  }

  return firstPrice;
}

export async function fetchModelTrend(
  supabase: SupabaseClient,
  slug: string
): Promise<ModelTrend | null> {
  const all = await fetchModelTrends(supabase);
  return all.find((t) => t.slug === slug) ?? null;
}
