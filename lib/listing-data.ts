import type { SupabaseClient } from '@supabase/supabase-js';

export type Listing = {
  id: string;
  listing_id: string;
  source: string;
  url: string;
  title: string;
  location: string;
  current_price: number;
  is_active: boolean;
  first_seen_at: string;
  original_posted_at: string | null;
  last_checked_at: string;
  image_url: string | null;
  created_at: string;
  seller: { id: string; name: string; city: string; lat: number | null; lng: number | null } | null;
  ai_opinion_rating: number | null;
  ai_opinion_summary: string | null;
  ai_opinion_price_note: string | null;
  ai_opinion_watch_out: string[] | null;
};

export type Snapshot = {
  id: string;
  price: number;
  title: string;
  description: string;
  photo_urls: string[];
  metadata: any;
  scraped_at: string;
};

export type SellerStats = {
  averageRating: number | null;
  reviewCount: number;
  listingsCount: number;
};

export type ReviewPhoto = {
  id: string;
  photo_url: string;
  file_size: number;
  order_index: number;
};

export type ReviewProfile = {
  display_name: string;
  is_partner: boolean;
  partner_logo_url: string | null;
};

export type ReviewWithDetails = {
  id: string;
  user_id: string;
  visited_in_person: boolean;
  rating: number;
  price_difference: string;
  condition_difference: string;
  size_mileage_difference: string;
  equipment_difference: string;
  photos_difference: string;
  comment: string;
  created_at: string;
  is_reported?: boolean;
  photos?: ReviewPhoto[];
  profile?: ReviewProfile | null;
};

export type ListingPageData = {
  listing: Listing;
  snapshots: Snapshot[];
  reviews: ReviewWithDetails[];
  reviewCount: number;
  averageRating: number | null;
  hasReportedReview: boolean;
  sellerStats: SellerStats | null;
  recommendedListings: Listing[];
};

const TWO_WORD_BRANDS = ['Alfa Romeo', 'Land Rover', 'Aston Martin', 'Rolls Royce', 'Great Wall'];

export function extractBrand(title: string): string {
  const trimmed = title.trim();
  const lower = trimmed.toLowerCase();
  const twoWordMatch = TWO_WORD_BRANDS.find((brand) => lower.startsWith(brand.toLowerCase()));
  if (twoWordMatch) return twoWordMatch;
  return trimmed.split(/\s+/)[0] || '';
}

/**
 * Dociąga opinie o zdjęcia i profile autorów. Wydzielone, bo ten sam kształt
 * danych jest potrzebny i przy renderze serwerowym, i przy odświeżeniu listy
 * po dodaniu nowej opinii.
 */
export async function attachReviewDetails(
  supabase: SupabaseClient,
  reviews: ReviewWithDetails[]
): Promise<ReviewWithDetails[]> {
  if (reviews.length === 0) return [];

  const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, display_name, is_partner, partner_logo_url')
    .in('id', userIds);

  const profilesById = new Map<string, ReviewProfile>();
  (profilesData || []).forEach((p) => {
    profilesById.set(p.id, {
      display_name: p.display_name,
      is_partner: p.is_partner,
      partner_logo_url: p.partner_logo_url,
    });
  });

  const { data: photosData } = await supabase
    .from('user_listing_photos')
    .select('id, photo_url, file_size, order_index, review_id')
    .in(
      'review_id',
      reviews.map((r) => r.id)
    )
    .order('order_index');

  const photosByReview = new Map<string, ReviewPhoto[]>();
  (photosData || []).forEach(({ review_id, ...photo }: any) => {
    const list = photosByReview.get(review_id) || [];
    list.push(photo);
    photosByReview.set(review_id, list);
  });

  return reviews.map((review) => ({
    ...review,
    photos: photosByReview.get(review.id) || [],
    profile: profilesById.get(review.user_id) ?? null,
  }));
}

async function fetchRecommendedListings(
  supabase: SupabaseClient,
  listing: Listing
): Promise<Listing[]> {
  const brand = extractBrand(listing.title || '');
  let recommended: Listing[] = [];

  if (brand) {
    let brandQuery = supabase
      .from('listings')
      .select('*')
      .eq('source', listing.source)
      .neq('id', listing.id)
      .eq('is_active', true)
      .gt('current_price', 0)
      .ilike('title', `${brand}%`);

    if (listing.current_price > 0) {
      brandQuery = brandQuery
        .gte('current_price', listing.current_price * 0.5)
        .lte('current_price', listing.current_price * 1.8);
    }

    const { data: brandMatches } = await brandQuery
      .order('created_at', { ascending: false })
      .limit(3);

    recommended = (brandMatches || []) as Listing[];
  }

  if (recommended.length < 3) {
    const excludeIds = [listing.id, ...recommended.map((r) => r.id)];
    const { data: fallbackMatches } = await supabase
      .from('listings')
      .select('*')
      .eq('source', listing.source)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .eq('is_active', true)
      .gt('current_price', 0)
      .order('created_at', { ascending: false })
      .limit(3 - recommended.length);

    recommended = [...recommended, ...((fallbackMatches || []) as Listing[])];
  }

  return recommended;
}

async function fetchSellerStats(
  supabase: SupabaseClient,
  sellerId: string
): Promise<SellerStats> {
  const { count: listingsCount } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId);

  const { data: sellerReviews } = await supabase
    .from('reviews')
    .select('rating, listing:listings!inner(seller_id)')
    .eq('is_approved', true)
    .eq('listing.seller_id', sellerId);

  const ratings = (sellerReviews || []).map((r) => r.rating);

  return {
    averageRating:
      ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
    reviewCount: ratings.length,
    listingsCount: listingsCount ?? 0,
  };
}

/**
 * Jedno źródło prawdy dla strony ogłoszenia. Wywoływane serwerowo przy renderze
 * (żeby treść trafiła do HTML-a i do metadanych) oraz klienta po dodaniu opinii.
 */
export async function fetchListingPageData(
  supabase: SupabaseClient,
  listingId: string
): Promise<ListingPageData | null> {
  const { data: listing, error } = await supabase
    .from('listings')
    .select('*, seller:sellers(id, name, city, lat, lng)')
    .eq('id', listingId)
    .maybeSingle();

  if (error || !listing) return null;

  const [{ data: snapshotsData }, { data: reviewsData }] = await Promise.all([
    supabase
      .from('listing_snapshots')
      .select('*')
      .eq('listing_id', listingId)
      .order('scraped_at', { ascending: false }),
    // Tylko zatwierdzone opinie: liczą się do średniej pokazywanej publicznie
    // i do danych strukturalnych, więc niezatwierdzona opinia nie może ruszać
    // oceny widocznej dla innych użytkowników.
    supabase
      .from('reviews')
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false }),
  ]);

  const approvedReviews = (reviewsData || []) as ReviewWithDetails[];
  const reviewCount = approvedReviews.length;
  const averageRating =
    reviewCount > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : null;

  const [reviews, recommendedListings, sellerStats] = await Promise.all([
    attachReviewDetails(supabase, approvedReviews),
    fetchRecommendedListings(supabase, listing as Listing),
    listing.seller ? fetchSellerStats(supabase, listing.seller.id) : Promise.resolve(null),
  ]);

  return {
    listing: listing as Listing,
    snapshots: (snapshotsData || []) as Snapshot[],
    reviews,
    reviewCount,
    averageRating,
    hasReportedReview: approvedReviews.some((r) => r.is_reported),
    sellerStats,
    recommendedListings,
  };
}
