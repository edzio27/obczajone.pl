import type { SupabaseClient } from '@supabase/supabase-js';

export type PartnerCategory = 'car' | 'home';

export type Partner = {
  id: string;
  slug: string;
  name: string;
  category: PartnerCategory;
  city: string | null;
  voivodeship: string | null;
  lat: number | null;
  lng: number | null;
  logo_url: string | null;
  contact_url: string;
  description: string;
  about: string;
  services: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  price_from: number | null;
  response_time: string | null;
  is_verified: boolean;
  is_promoted: boolean;
  is_active: boolean;
  partner_since: string | null;
  rating_avg: number | null;
  rating_count: number;
  inspection_count: number;
};

export type PartnerReviewAuthor = {
  display_name: string;
};

export type PartnerReviewReply = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type PartnerReview = {
  id: string;
  partner_id: string;
  user_id: string;
  listing_id: string | null;
  rating: number;
  comment: string;
  service_type: string;
  is_verified_customer: boolean;
  is_approved: boolean;
  is_reported: boolean;
  created_at: string;
  updated_at: string;
  author?: PartnerReviewAuthor | null;
  reply?: PartnerReviewReply | null;
};

export type InspectionVerdict = 'recommended' | 'reservations' | 'not_recommended';

export type PartnerInspection = {
  id: string;
  partner_id: string;
  listing_id: string;
  verdict: InspectionVerdict;
  summary: string;
  findings: string[];
  price_opinion: string;
  inspected_at: string | null;
  is_approved: boolean;
  created_at: string;
  listing?: { id: string; title: string; image_url: string | null } | null;
  partner?: Pick<Partner, 'id' | 'slug' | 'name' | 'logo_url' | 'is_verified' | 'rating_avg' | 'rating_count'> | null;
};

/**
 * Kolumny profilu partnera. Trzymane w jednym miejscu, bo ta sama lista jest
 * potrzebna przy renderze serwerowym profilu, na mapie i w CTA na ogłoszeniu -
 * a rozjazd między nimi to najczęstsze źródło "u mnie ocena się nie wyświetla".
 */
export const PARTNER_COLUMNS =
  'id, slug, name, category, city, voivodeship, lat, lng, logo_url, contact_url, ' +
  'description, about, services, phone, email, website, price_from, response_time, ' +
  'is_verified, is_promoted, is_active, partner_since, rating_avg, rating_count, inspection_count';

export const VERDICT_LABELS: Record<InspectionVerdict, string> = {
  recommended: 'Polecam',
  reservations: 'Z zastrzeżeniami',
  not_recommended: 'Odradzam',
};

export function formatRating(rating: number | null): string {
  if (rating == null) return '—';
  return rating.toFixed(1).replace('.', ',');
}

/**
 * Odmiana "opinia/opinie/opinii" - bez tego licznik przy ocenie czyta się jak
 * automat, a to jest element, który ma budować zaufanie.
 */
export function reviewCountLabel(count: number): string {
  if (count === 1) return '1 opinia';
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo < 10 || lastTwo > 20) {
    if (last >= 2 && last <= 4) return `${count} opinie`;
  }
  return `${count} opinii`;
}

export async function fetchPartnerBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Partner | null> {
  const { data } = await supabase
    .from('partners')
    .select(PARTNER_COLUMNS)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  return (data as unknown as Partner) ?? null;
}

/**
 * Sortowanie katalogu partnerów. Płatne wyróżnienie idzie na górę, ale nigdy
 * przed jakością w obrębie grupy - i zawsze jest w interfejsie oznaczone jako
 * promowane, bo nieoznaczone płatne pozycjonowanie w wynikach to nieuczciwa
 * praktyka rynkowa (dyrektywa Omnibus).
 */
export function comparePartners(a: Partner, b: Partner): number {
  if (a.is_promoted !== b.is_promoted) return a.is_promoted ? -1 : 1;
  if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
  const ratingDiff = (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
  if (ratingDiff !== 0) return ratingDiff;
  return b.rating_count - a.rating_count;
}

export async function fetchPartners(
  supabase: SupabaseClient,
  options: { category?: PartnerCategory } = {}
): Promise<Partner[]> {
  let query = supabase.from('partners').select(PARTNER_COLUMNS).eq('is_active', true);

  if (options.category) {
    query = query.eq('category', options.category);
  }

  const { data } = await query;
  return ((data as unknown as Partner[]) || []).sort(comparePartners);
}

/**
 * Opinie o partnerze wraz z autorem i odpowiedzią firmy. Odpowiedź dociągamy
 * osobno zamiast zagnieżdżonym selectem, bo RLS na `partner_review_replies`
 * ma własne warunki i zagnieżdżony join po cichu gubi wiersze, gdy się rozjadą.
 */
export async function fetchPartnerReviews(
  supabase: SupabaseClient,
  partnerId: string,
  options: { includePending?: boolean } = {}
): Promise<PartnerReview[]> {
  let query = supabase
    .from('partner_reviews')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (!options.includePending) {
    query = query.eq('is_approved', true);
  }

  const { data } = await query;
  const reviews = ((data as PartnerReview[]) || []);
  if (reviews.length === 0) return [];

  const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));
  const [{ data: profiles }, { data: replies }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', userIds),
    supabase
      .from('partner_review_replies')
      .select('id, review_id, body, created_at, updated_at')
      .in(
        'review_id',
        reviews.map((r) => r.id)
      ),
  ]);

  const profileById = new Map<string, PartnerReviewAuthor>();
  (profiles || []).forEach((p: any) => profileById.set(p.id, { display_name: p.display_name }));

  const replyByReview = new Map<string, PartnerReviewReply>();
  (replies || []).forEach(({ review_id, ...reply }: any) => replyByReview.set(review_id, reply));

  return reviews.map((review) => ({
    ...review,
    author: profileById.get(review.user_id) ?? null,
    reply: replyByReview.get(review.id) ?? null,
  }));
}

export async function fetchPartnerInspections(
  supabase: SupabaseClient,
  partnerId: string,
  options: { includePending?: boolean; limit?: number } = {}
): Promise<PartnerInspection[]> {
  let query = supabase
    .from('partner_inspections')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 20);

  if (!options.includePending) {
    query = query.eq('is_approved', true);
  }

  const { data } = await query;
  const inspections = ((data as PartnerInspection[]) || []);
  if (inspections.length === 0) return [];

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, image_url')
    .in(
      'id',
      inspections.map((i) => i.listing_id)
    );

  const listingById = new Map<string, any>();
  (listings || []).forEach((l: any) => listingById.set(l.id, l));

  return inspections.map((inspection) => ({
    ...inspection,
    listing: listingById.get(inspection.listing_id) ?? null,
  }));
}

/** Opublikowane oględziny przy konkretnym ogłoszeniu - dla strony ogłoszenia. */
export async function fetchListingInspections(
  supabase: SupabaseClient,
  listingId: string
): Promise<PartnerInspection[]> {
  const { data } = await supabase
    .from('partner_inspections')
    .select('*')
    .eq('listing_id', listingId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  const inspections = ((data as PartnerInspection[]) || []);
  if (inspections.length === 0) return [];

  const { data: partners } = await supabase
    .from('partners')
    .select('id, slug, name, logo_url, is_verified, rating_avg, rating_count')
    .in(
      'id',
      inspections.map((i) => i.partner_id)
    );

  const partnerById = new Map<string, any>();
  (partners || []).forEach((p: any) => partnerById.set(p.id, p));

  return inspections.map((inspection) => ({
    ...inspection,
    partner: partnerById.get(inspection.partner_id) ?? null,
  }));
}

/**
 * Odpowiednik funkcji `slugify()` z bazy. Musi dawać ten sam wynik, bo adres
 * profilu powstaje po stronie klienta przy dodawaniu partnera w panelu admina,
 * a kolumna `slug` jest NOT NULL i unikalna.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => 'acelnoszz'['ąćęłńóśźż'.indexOf(char)])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
