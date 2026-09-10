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
  'id, title, location, current_price, first_price, source, created_at, image_url, ai_opinion_rating';

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

  /*
    Cena początkowa jest kolumną w `listings`, więc nie ma tu już zapytania -
    wcześniej po każdą listę ogłoszeń szło osobne pobranie ich historii cen.
  */

  return listings.map((listing) => {
    const reviews = listing.reviews || [];
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
        : undefined;
    const earliestPrice = listing.first_price ?? undefined;

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


/** Wszystkie aktywne ogłoszenia z ceną - pula, w której szukamy obniżek. */
async function fetchActiveListings(supabase: SupabaseClient, columns: string): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data } = await supabase
      .from('listings')
      .select(columns)
      .eq('is_active', true)
      .gt('current_price', 0)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    const rows = (data as any[]) || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }

  return all;
}


export async function fetchBiggestPriceDrops(
  supabase: SupabaseClient,
  limit = 3
): Promise<HomeListing[]> {
  const pool = await fetchActiveListings(supabase, CARD_COLUMNS);
  if (pool.length === 0) return [];

  return pool
    .map((listing) => ({
      ...listing,
      priceChangePercent:
        listing.first_price != null
          ? computePriceChangePercent(listing.current_price, listing.first_price)
          : null,
    }))
    .filter((l) => l.priceChangePercent != null && l.priceChangePercent < 0)
    .sort((a, b) => a.priceChangePercent! - b.priceChangePercent!)
    .slice(0, limit) as HomeListing[];
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

/** Ilu kandydatów sprawdzamy, zanim uznamy, że nie ma czego narysować. */
const HERO_CANDIDATES = 8;

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
  const pool = await fetchActiveListings(
    supabase,
    'id, title, location, current_price, first_price, source, image_url'
  );

  if (pool.length === 0) return null;

  /*
    Kandydatów układamy od najmocniejszej obniżki i schodzimy w dół, aż trafimy
    takiego, który ma dość pomiarów na wykres.

    Wcześniej brany był wyłącznie pierwszy z listy, a gdy odpadał na liczbie
    pomiarów, funkcja zwracała null i nagłówek zostawał pusty - mimo że tuż za
    nim stali kandydaci w zupełnie dobrym stanie. Tak wlasnie zniknął wykres:
    Porsche Macan ze spadkiem 35,3% ma dwa pomiary przy wymaganych trzech,
    a stojące za nim Volvo S60 z 34,5% ma ich osiem.

    Liczby pomiarów nie da się odczytać z kolumny, więc trzeba po nią sięgnąć
    do historii - ale robimy to najwyżej dla kilku pierwszych, a nie dla całej
    puli, więc koszt zostaje ograniczony do stałej.
  */
  const candidates = pool
    .filter((l) => l.first_price != null && l.first_price > 0)
    .map((l) => ({
      listing: l,
      changePercent: computePriceChangePercent(l.current_price, l.first_price),
    }))
    .filter(
      (c): c is { listing: any; changePercent: number } =>
        c.changePercent != null && c.changePercent <= HERO_MIN_DROP_PERCENT
    )
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, HERO_CANDIDATES);

  for (const candidate of candidates) {
    const { data: snapshotsData } = await supabase
      .from('listing_snapshots')
      .select('price, scraped_at')
      .eq('listing_id', candidate.listing.id)
      .gt('price', 0)
      .order('scraped_at', { ascending: true });

    const snaps = (snapshotsData as { price: number; scraped_at: string }[]) || [];
    if (snaps.length < HERO_MIN_SNAPSHOTS) continue;

    const best = candidate;

    return {
      id: best.listing.id,
      title: best.listing.title,
      location: best.listing.location || '',
      image_url: best.listing.image_url ?? null,
      source: best.listing.source,
      currentPrice: best.listing.current_price,
      startPrice: snaps[0].price,
      changePercent: best.changePercent,
      // Ostatnim punktem jest cena bieżąca, a nie ostatni snapshot - te dwie
      // wartości rozjeżdżają się między przebiegami scrapera i wykres kończyłby
      // się gdzie indziej, niż mówi liczba obok niego.
      series: [...snaps.map((s) => s.price), best.listing.current_price],
      firstSeenAt: snaps[0].scraped_at,
    };
  }

  // Żaden z kandydatów nie ma historii na wykres - lepiej nagłówek bez wykresu
  // niż linia z dwóch punktów, która niczego nie pokazuje.
  return null;
}
