import type { SupabaseClient } from '@supabase/supabase-js';
import { attachPriceChanges, type HomeListing } from './home-data';

/*
  Ogłoszenia, których już nie ma w źródle.

  Dla serwisu to był dotąd odpad - listy filtrowały po `is_active`, a sitemapa
  ich nie zgłaszała. W Search Console wygląda to inaczej: "archiwum otomoto",
  "historia ogłoszeń otomoto" i "otomoto historia cen" to trzy z pięciu
  najczęstszych zapytań, którymi ludzie tu trafiają, i wszystkie trzy rosną.
  Szukają ogłoszenia, które zniknęło - bo chcą wiedzieć, za ile ostatecznie
  poszło albo czy to ta sama sztuka, którą teraz widzą drożej.

  Otomoto po zdjęciu oferty kasuje stronę. My mamy zapisaną cenę i jej historię,
  więc jesteśmy jedynym miejscem, które na to pytanie odpowiada.
*/

const CARD_COLUMNS =
  'id, title, location, current_price, first_price, source, created_at, image_url, ai_opinion_rating';

export type ArchiveStats = {
  /** Ile zdjętych ogłoszeń mamy opisanych. */
  total: number;
  /** Ile z nich zdążyło stanieć, zanim zniknęło. */
  dropped: number;
  /** Mediana obniżki wśród tych, które staniały - w procentach ceny wyjściowej. */
  medianDropPercent: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Ostatnio zdjęte ogłoszenia, od najświeższych.
 *
 * `last_checked_at` to moment, w którym przelot zastał ofertę już nieobecną -
 * czyli najbliższe, co mamy, dacie zniknięcia.
 */
export async function fetchArchivedListings(
  supabase: SupabaseClient,
  { source, limit = 60 }: { source?: string; limit?: number } = {}
): Promise<HomeListing[]> {
  let query = supabase
    .from('listings')
    .select(CARD_COLUMNS)
    .eq('is_active', false)
    .gt('current_price', 0)
    .neq('title', '')
    .order('last_checked_at', { ascending: false })
    .limit(limit);

  if (source) query = query.eq('source', source);

  const { data } = await query;
  return attachPriceChanges(supabase, data ?? []);
}

/**
 * Liczby opisujące archiwum.
 *
 * Mediana liczona jest z `first_price` i `current_price`, czyli z kolumn, a nie
 * z przeglądania historii - ta instancja bazy raz już wyczerpała budżet Disk IO
 * na skanowaniu `listing_snapshots` i nie ma powodu tego powtarzać.
 */
export async function fetchArchiveStats(
  supabase: SupabaseClient,
  { source }: { source?: string } = {}
): Promise<ArchiveStats> {
  let countQuery = supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', false)
    .gt('current_price', 0)
    .neq('title', '');

  if (source) countQuery = countQuery.eq('source', source);

  let droppedQuery = supabase
    .from('listings')
    .select('first_price, current_price')
    .eq('is_active', false)
    .gt('current_price', 0)
    .gt('first_price', 0)
    .neq('title', '');

  if (source) droppedQuery = droppedQuery.eq('source', source);

  const [{ count }, { data: rows }] = await Promise.all([countQuery, droppedQuery]);

  const drops = (rows ?? [])
    .filter((r: any) => Number(r.current_price) < Number(r.first_price))
    .map((r: any) => (100 * (Number(r.first_price) - Number(r.current_price))) / Number(r.first_price));

  return {
    total: count ?? 0,
    dropped: drops.length,
    medianDropPercent: median(drops),
  };
}
