import type { SupabaseClient } from '@supabase/supabase-js';
import { computePriceChangePercent } from './price-change';

export type HomeListing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  url?: string;
  image_url: string;
  ai_opinion_rating?: number | null;
  average_rating?: number;
  review_count?: number;
  priceChangePercent?: number | null;
};

const CARD_COLUMNS =
  'id, title, location, current_price, source, created_at, image_url, ai_opinion_rating';

/**
 * Dokleja zmianę ceny względem najstarszego snapshotu. Wyciągnięte z komponentu,
 * bo tego samego wyliczenia potrzebuje render serwerowy i doładowywanie
 * kolejnych stron po stronie klienta.
 */
export async function attachPriceChanges(
  supabase: SupabaseClient,
  listings: any[]
): Promise<HomeListing[]> {
  if (listings.length === 0) return [];

  const ids = listings.map((l) => l.id);
  const { data: snapshotsData } = await supabase
    .from('listing_snapshots')
    .select('listing_id, price, scraped_at')
    .in('listing_id', ids)
    .order('scraped_at', { ascending: true });

  const earliestPriceByListing = new Map<string, number>();
  for (const snap of snapshotsData || []) {
    if (!earliestPriceByListing.has(snap.listing_id)) {
      earliestPriceByListing.set(snap.listing_id, snap.price);
    }
  }

  return listings.map((listing) => {
    const reviews = listing.reviews || [];
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
        : undefined;
    const earliestPrice = earliestPriceByListing.get(listing.id);

    return {
      ...listing,
      average_rating: avgRating,
      review_count: reviews.length,
      priceChangePercent:
        earliestPrice != null
          ? computePriceChangePercent(listing.current_price, earliestPrice)
          : null,
    };
  });
}

export async function fetchRecentListings(
  supabase: SupabaseClient,
  { pageSize = 9, page = 0, search = '' }: { pageSize?: number; page?: number; search?: string } = {}
): Promise<HomeListing[]> {
  let query = supabase.from('listings').select('*, reviews(rating)').gt('current_price', 0);

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  const from = page * pageSize;
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error || !data) return [];

  return attachPriceChanges(supabase, data);
}

export async function fetchRecentlyChecked(
  supabase: SupabaseClient,
  limit = 3
): Promise<HomeListing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(CARD_COLUMNS)
    .eq('is_active', true)
    .gt('current_price', 0)
    .order('last_checked_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as HomeListing[];
}

export async function fetchBiggestPriceDrops(
  supabase: SupabaseClient,
  limit = 3
): Promise<HomeListing[]> {
  const { data: pool, error } = await supabase
    .from('listings')
    .select(CARD_COLUMNS)
    .eq('is_active', true)
    .gt('current_price', 0)
    .order('last_checked_at', { ascending: false })
    .limit(100);

  if (error || !pool || pool.length === 0) return [];

  const { data: snapshotsData } = await supabase
    .from('listing_snapshots')
    .select('listing_id, price, scraped_at')
    .in(
      'listing_id',
      pool.map((l: any) => l.id)
    )
    .order('scraped_at', { ascending: true });

  const earliestPriceByListing = new Map<string, number>();
  for (const snap of snapshotsData || []) {
    if (!earliestPriceByListing.has(snap.listing_id)) {
      earliestPriceByListing.set(snap.listing_id, snap.price);
    }
  }

  return (pool as any[])
    .map((listing) => {
      const earliestPrice = earliestPriceByListing.get(listing.id);
      return {
        ...listing,
        priceChangePercent:
          earliestPrice != null
            ? computePriceChangePercent(listing.current_price, earliestPrice)
            : null,
      } as HomeListing;
    })
    .filter((l) => l.priceChangePercent != null && l.priceChangePercent < 0)
    .sort((a, b) => a.priceChangePercent! - b.priceChangePercent!)
    .slice(0, limit);
}

export async function fetchRecentlyReviewedListings(
  supabase: SupabaseClient,
  limit = 3
): Promise<HomeListing[]> {
  const { data: reviewsData, error } = await supabase
    .from('reviews')
    .select('listing_id')
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  if (error || !reviewsData) return [];

  const uniqueIds: string[] = [];
  for (const r of reviewsData) {
    if (!uniqueIds.includes(r.listing_id)) {
      uniqueIds.push(r.listing_id);
      if (uniqueIds.length >= limit) break;
    }
  }

  if (uniqueIds.length === 0) return [];

  const { data: listingsData } = await supabase
    .from('listings')
    .select('*, reviews(rating)')
    .in('id', uniqueIds)
    .gt('current_price', 0);

  if (!listingsData) return [];

  // Kolejność z zapytania o opinie niesie informację "ostatnio komentowane",
  // więc odtwarzamy ją zamiast polegać na kolejności zwróconej przez bazę.
  return uniqueIds
    .map((id) => listingsData.find((l: any) => l.id === id))
    .filter(Boolean)
    .map((listing: any) => {
      const reviews = listing.reviews || [];
      return {
        ...listing,
        average_rating:
          reviews.length > 0
            ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
            : undefined,
        review_count: reviews.length,
      } as HomeListing;
    });
}

export async function fetchDealerMapCounts(
  supabase: SupabaseClient
): Promise<{ sellerCount: number | null; reviewCount: number | null }> {
  const [{ count: sellerCount }, { count: reviewCount }] = await Promise.all([
    supabase
      .from('sellers')
      .select('id', { count: 'exact', head: true })
      .not('lat', 'is', null)
      .not('lng', 'is', null),
    supabase
      .from('reviews')
      .select('id, listing:listings!inner(seller_id)', { count: 'exact', head: true })
      .eq('is_approved', true)
      .not('listing.seller_id', 'is', null),
  ]);

  return { sellerCount: sellerCount ?? null, reviewCount: reviewCount ?? null };
}
