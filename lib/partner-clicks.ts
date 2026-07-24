import { supabase } from '@/lib/supabase';

type PartnerClickContext = 'listing_cta' | 'homepage' | 'partners_page';

export function logPartnerClick(
  partnerId: string,
  context: PartnerClickContext,
  listingId?: string
) {
  supabase
    .from('partner_clicks')
    .insert({ partner_id: partnerId, context, listing_id: listingId ?? null })
    .then(({ error }) => {
      if (error) console.error('Error logging partner click:', error);
    });
}
