import type { SupabaseClient } from '@supabase/supabase-js';

/** Poniżej tylu ogłoszeń mediana ceny za metr opisuje przypadek, nie miasto. */
export const MIN_CITY_LISTINGS = 20;

export type CityPrices = {
  city: string;
  slug: string;
  listings: number;
  medianPrice: number;
  medianPricePerM2: number | null;
  medianArea: number | null;
  dropped: number;
  medianDropPercent: number | null;
};

/** Adres strony miasta. Ta sama zasada co przy modelach aut. */
export function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ceny mieszkań miasto po mieście.
 *
 * Liczy baza i oddaje kilkanaście wierszy - tak samo jak barometr i z tego
 * samego powodu. Mediana wyciągana w Next z pobranych ogłoszeń jest dokładnie
 * tym, co 7 września wyczerpało budżet Disk IO tej instancji.
 */
export async function fetchCityPrices(supabase: SupabaseClient): Promise<CityPrices[]> {
  const { data } = await supabase.rpc('city_price_stats', {
    min_listings: MIN_CITY_LISTINGS,
  });

  return (data ?? []).map((r: any) => ({
    city: r.city,
    slug: slugifyCity(r.city),
    listings: Number(r.listings),
    medianPrice: Number(r.median_price),
    medianPricePerM2: r.median_price_per_m2 == null ? null : Number(r.median_price_per_m2),
    medianArea: r.median_area == null ? null : Number(r.median_area),
    dropped: Number(r.dropped),
    medianDropPercent:
      r.median_drop_percent == null ? null : Number(r.median_drop_percent),
  }));
}

export async function fetchCityPrice(
  supabase: SupabaseClient,
  slug: string
): Promise<CityPrices | null> {
  const all = await fetchCityPrices(supabase);
  return all.find((c) => c.slug === slug) ?? null;
}
