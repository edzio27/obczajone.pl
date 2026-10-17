import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPriceComparison, type CarSpecs } from './price-comparison';
import { fetchModelTrend, type ModelTrend } from './price-trends';
import { slugifyModel } from './model-slug';
import { assessNegotiation, assessPriceVerdict, type NegotiationHint, type PriceVerdict } from './price-verdict';

/** Jeden wiersz porównania: wszystko, co potrzebne do kolumny jednego auta. */
export type CompareCar = {
  id: string;
  title: string;
  url: string;
  source: string;
  location: string | null;
  imageUrl: string | null;
  isActive: boolean;
  price: number;
  firstPrice: number | null;
  /** Zmiana od pierwszej zapisanej ceny, w procentach (ujemna = taniej). */
  changePercent: number | null;
  dropCount: number;
  daysListed: number | null;
  lastCheckedAt: string | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  power: string | null;
  verdict: PriceVerdict | null;
  medianPrice: number | null;
  negotiation: NegotiationHint | null;
  trendSlug: string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/**
 * Dane do porównania kilku aut. Liczone w przeglądarce na żądanie jednej
 * osoby i dla najwyżej pięciu ogłoszeń, więc kilka zapytań na auto jest
 * w porządku - nie stoi to na ścieżce żadnego crawlera.
 */
export async function fetchCompareCars(supabase: SupabaseClient, ids: string[]): Promise<CompareCar[]> {
  if (ids.length === 0) return [];

  const [{ data: listings, error }, { data: snapshots }] = await Promise.all([
    supabase.from('listings').select('*').in('id', ids),
    supabase
      .from('listing_snapshots')
      .select('listing_id, price, scraped_at, photo_urls')
      .in('listing_id', ids)
      .order('scraped_at', { ascending: true }),
  ]);
  if (error) throw new Error(`Nie udało się pobrać aut do porównania: ${error.message}`);

  const trendCache = new Map<string, Promise<ModelTrend | null>>();
  const trendFor = (slug: string) => {
    if (!trendCache.has(slug)) trendCache.set(slug, fetchModelTrend(supabase, slug));
    return trendCache.get(slug)!;
  };

  const cars = await Promise.all(
    (listings ?? []).map(async (l: any): Promise<CompareCar> => {
      const history = (snapshots ?? []).filter((s: any) => s.listing_id === l.id);
      const prices = history.map((s: any) => Number(s.price));
      const firstPrice = prices.length > 0 ? prices[0] : l.first_price ?? null;
      const price = Number(l.current_price);
      const dropCount = prices.reduce((n, p, i) => (i > 0 && p < prices[i - 1] ? n + 1 : n), 0);
      const since = l.original_posted_at ?? l.first_seen_at;
      const until = l.is_active ? Date.now() : new Date(l.last_checked_at ?? Date.now()).getTime();
      const specs: (CarSpecs & Record<string, any>) | null = l.specs;
      const trendSlug =
        l.source === 'otomoto' && specs?.brand && specs?.model ? slugifyModel(specs.brand, specs.model) : null;

      const [comparison, trend] = await Promise.all([
        fetchPriceComparison(supabase, l).catch(() => null),
        trendSlug ? trendFor(trendSlug).catch(() => null) : Promise.resolve(null),
      ]);

      const photoSnapshot = [...history].reverse().find((s: any) => s.photo_urls?.length > 0);

      return {
        id: l.id,
        title: l.title,
        url: l.url,
        source: l.source,
        location: l.location || null,
        imageUrl: photoSnapshot?.photo_urls?.[0] ?? (l.image_url || null),
        isActive: l.is_active,
        price,
        firstPrice,
        changePercent: firstPrice && firstPrice > 0 && price > 0 ? ((price - firstPrice) / firstPrice) * 100 : null,
        dropCount,
        daysListed: since ? Math.max(0, Math.round((until - new Date(since).getTime()) / 86_400_000)) : null,
        lastCheckedAt: l.last_checked_at,
        year: toNumber(specs?.year),
        mileage: toNumber(specs?.mileage),
        fuel: specs?.fuel_type ?? null,
        power: specs?.engine_power ?? null,
        verdict: assessPriceVerdict(price, comparison),
        medianPrice: comparison?.sufficient ? comparison.medianPrice : null,
        negotiation: l.is_active ? assessNegotiation(price, firstPrice, trend) : null,
        trendSlug: trend ? trendSlug : null,
      };
    })
  );

  // W kolejności, w jakiej ktoś je dodawał - tak je zapamiętał.
  return ids.map((id) => cars.find((c) => c.id === id)).filter((c): c is CompareCar => !!c && c.price > 0);
}
