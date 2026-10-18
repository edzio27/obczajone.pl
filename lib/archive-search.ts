import type { SupabaseClient } from '@supabase/supabase-js';
import { attachPriceChanges, type HomeListing } from './home-data';

const CARD_COLUMNS =
  'id, title, location, current_price, first_price, source, created_at, image_url, ai_opinion_rating, price_verdict';

/**
 * Wyszukiwanie w archiwum zdjętych ogłoszeń Otomoto po słowach z tytułu.
 *
 * Każde słowo musi wystąpić w tytule (AND), bez względu na kolejność i wielkość
 * liter, więc „octavia skoda” znajdzie to samo co „Skoda Octavia”. Archiwum ma
 * kilka tysięcy wierszy, a zapytanie odpala człowiek, nie crawler - pełny skan
 * po tytule jest tu tańszy niż utrzymywanie indeksu pełnotekstowego.
 */
export async function searchArchive(
  supabase: SupabaseClient,
  query: string,
  limit = 24
): Promise<HomeListing[]> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[%_,()]/g, ''))
    .filter((w) => w.length >= 2)
    .slice(0, 5);

  let request = supabase
    .from('listings')
    .select(CARD_COLUMNS)
    .eq('source', 'otomoto')
    .eq('is_active', false)
    .gt('current_price', 0)
    .neq('title', '');

  for (const word of words) {
    request = request.ilike('title', `%${word}%`);
  }

  const { data, error } = await request.order('last_checked_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`Nie udało się przeszukać archiwum: ${error.message}`);
  return attachPriceChanges(supabase, data ?? []);
}
