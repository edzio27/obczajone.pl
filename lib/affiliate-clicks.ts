import { supabase } from '@/lib/supabase';

export type AffiliateClickContext = 'listing' | 'model_page';

/**
 * Odnotowuje kliknięcie w link afiliacyjny.
 *
 * Świadomie nie czekamy na odpowiedź i nie blokujemy przejścia: link ma otworzyć
 * się natychmiast, a nieudany zapis licznika jest mniejszym problemem niż
 * użytkownik patrzący na nieruchomą stronę. Z tego samego powodu błąd tylko
 * logujemy - nie ma czego pokazywać odwiedzającemu.
 */
export function logAffiliateClick(
  provider: string,
  context: AffiliateClickContext,
  listingId?: string
) {
  supabase
    .from('affiliate_clicks')
    .insert({ provider, context, listing_id: listingId ?? null })
    .then(({ error }) => {
      if (error) console.error('Error logging affiliate click:', error);
    });
}
