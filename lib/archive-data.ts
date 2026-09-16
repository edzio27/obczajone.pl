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

  Zdjęta oferta znika z Otomoto - sprzedający ma ją jeszcze pół roku w archiwum
  swojego konta, ale dla kupującego zostaje pusty adres. My mamy zapisaną cenę
  i jej historię, więc odpowiadamy na pytanie, na które nie odpowiada nikt inny.

  Uwaga na tę różnicę przy pisaniu tekstów: "Otomoto kasuje ogłoszenie" jest
  nieprawdą i łatwo ją sprawdzić - pierwszy wynik wyszukiwania na "archiwum
  otomoto" to ich własna pomoc, która mówi o tych sześciu miesiącach.
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
 * Liczy baza i oddaje jeden wiersz. Wcześniej ta funkcja ściągała wszystkie
 * wygaszone ogłoszenia do Node'a po to, żeby policzyć z nich medianę - przy
 * budowaniu, gdy strony generują się równolegle, wystarczyło to, by strona
 * archiwum przekroczyła limit i cały build się wywalił.
 */
export async function fetchArchiveStats(
  supabase: SupabaseClient,
  { source }: { source?: string } = {}
): Promise<ArchiveStats> {
  const { data, error } = await supabase.rpc('archive_stats', {
    p_source: source ?? null,
  });

  if (error || !data || data.length === 0) {
    console.error('Nie udało się policzyć statystyk archiwum:', error?.message);
    return { total: 0, dropped: 0, medianDropPercent: null };
  }

  const row = (data as any[])[0];

  return {
    total: Number(row.total),
    dropped: Number(row.dropped),
    medianDropPercent: row.median_drop_pct == null ? null : Number(row.median_drop_pct),
  };
}
