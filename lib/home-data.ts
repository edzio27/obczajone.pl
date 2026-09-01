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

export type InspectedListing = HomeListing & {
  verdict: string;
  partnerName: string;
  partnerSlug: string;
};

/**
 * Ogłoszenia, przy których partner opublikował werdykt z oględzin.
 *
 * Zastępuje "Ostatnio sprawdzane", które sortowało po `last_checked_at`, czyli
 * po tym, kiedy scraper ostatnio zajrzał po cenę. Dla odwiedzającego to była
 * informacja o nas, nie o aucie - a słowo "sprawdzane" sugerowało oględziny,
 * których tam nie było. Tutaj są prawdziwe: ktoś pojechał i obejrzał ten
 * konkretny egzemplarz.
 */
export async function fetchRecentlyInspected(
  supabase: SupabaseClient,
  limit = 3
): Promise<InspectedListing[]> {
  const { data: inspections } = await supabase
    .from('partner_inspections')
    .select('listing_id, partner_id, verdict, created_at')
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = inspections || [];
  if (rows.length === 0) return [];

  const [{ data: listings }, { data: partners }] = await Promise.all([
    supabase
      .from('listings')
      .select(CARD_COLUMNS)
      .in('id', rows.map((i: any) => i.listing_id)),
    supabase
      .from('partners')
      .select('id, name, slug')
      .in('id', rows.map((i: any) => i.partner_id)),
  ]);

  const listingById = new Map((listings || []).map((l: any) => [l.id, l]));
  const partnerById = new Map((partners || []).map((p: any) => [p.id, p]));

  return rows
    .map((row: any) => {
      const listing = listingById.get(row.listing_id);
      const partner = partnerById.get(row.partner_id);
      if (!listing || !partner) return null;
      return {
        ...(listing as HomeListing),
        verdict: row.verdict,
        partnerName: partner.name,
        partnerSlug: partner.slug,
      };
    })
    .filter(Boolean) as InspectedListing[];
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

export type HomeStats = {
  listingCount: number | null;
  reviewCount: number | null;
  inspectionCount: number | null;
  partnerCount: number | null;
};

/**
 * Cztery liczby pod pasek zaufania w nagłówku strony.
 *
 * Wszystkie są liczone z bazy - żadna nie jest wpisana na sztywno. Kiedy któraś
 * jeszcze nic nie znaczy (zero opinii, zero oględzin), pasek chowa ją zamiast
 * reklamować pustkę; decyzję o tym podejmuje komponent, tutaj zwracamy fakty.
 */
export async function fetchHomeStats(supabase: SupabaseClient): Promise<HomeStats> {
  const [listings, reviews, inspections, partners] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', true),
    supabase
      .from('partner_inspections')
      .select('id', { count: 'exact', head: true })
      .eq('is_approved', true),
    supabase
      .from('partners')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
  ]);

  return {
    listingCount: listings.count ?? null,
    reviewCount: reviews.count ?? null,
    inspectionCount: inspections.count ?? null,
    partnerCount: partners.count ?? null,
  };
}

export type HeroSpotlight = {
  id: string;
  title: string;
  location: string;
  image_url: string | null;
  source: string;
  currentPrice: number;
  startPrice: number;
  changePercent: number;
  /** Ceny w kolejności chronologicznej - wprost do narysowania wykresu. */
  series: number[];
  firstSeenAt: string;
};

const HERO_MIN_SNAPSHOTS = 3;
const HERO_MIN_DROP_PERCENT = -3;

/**
 * Jedno ogłoszenie do wykresu w nagłówku strony głównej.
 *
 * Szukamy najmocniejszej obniżki wśród ofert, które mają dość punktów pomiaru,
 * żeby linia w ogóle miała kształt - dwa snapshoty rysują odcinek, a odcinek
 * niczego nie pokazuje. Zwracamy null, kiedy nic nie spełnia warunków; wtedy
 * nagłówek renderuje się bez wykresu, zamiast pokazywać wymyśloną krzywą.
 * Cała wartość tego miejsca polega na tym, że to prawdziwa oferta z bazy.
 */
export async function fetchHeroSpotlight(
  supabase: SupabaseClient
): Promise<HeroSpotlight | null> {
  const { data: pool, error } = await supabase
    .from('listings')
    .select('id, title, location, current_price, source, image_url')
    .eq('is_active', true)
    .gt('current_price', 0)
    .not('title', 'is', null)
    .order('last_checked_at', { ascending: false })
    .limit(100);

  if (error || !pool || pool.length === 0) return null;

  const { data: snapshotsData } = await supabase
    .from('listing_snapshots')
    .select('listing_id, price, scraped_at')
    .in(
      'listing_id',
      pool.map((l: any) => l.id)
    )
    .order('scraped_at', { ascending: true });

  const byListing = new Map<string, { price: number; scraped_at: string }[]>();
  for (const snap of snapshotsData || []) {
    const bucket = byListing.get(snap.listing_id);
    if (bucket) bucket.push(snap);
    else byListing.set(snap.listing_id, [snap]);
  }

  let best: HeroSpotlight | null = null;

  for (const listing of pool as any[]) {
    const snaps = byListing.get(listing.id);
    if (!snaps || snaps.length < HERO_MIN_SNAPSHOTS) continue;

    const startPrice = snaps[0].price;
    const changePercent = computePriceChangePercent(listing.current_price, startPrice);
    if (changePercent == null || changePercent > HERO_MIN_DROP_PERCENT) continue;
    if (best && changePercent >= best.changePercent) continue;

    // Ostatnim punktem jest cena bieżąca, a nie ostatni snapshot - te dwie
    // wartości rozjeżdżają się między przebiegami scrapera i wykres kończyłby
    // się gdzie indziej, niż mówi liczba obok niego.
    const series = [...snaps.map((s) => s.price), listing.current_price];

    best = {
      id: listing.id,
      title: listing.title,
      location: listing.location || '',
      image_url: listing.image_url ?? null,
      source: listing.source,
      currentPrice: listing.current_price,
      startPrice,
      changePercent,
      series,
      firstSeenAt: snaps[0].scraped_at,
    };
  }

  return best;
}
