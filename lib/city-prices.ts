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
 * Ceny mieszkań miasto po mieście, czytane z gotowego wiersza.
 *
 * Percentyle liczy cron o :55 i zapisuje do `city_prices_snapshot`; tutaj
 * zostaje jeden odczyt. Liczenie ich przy renderowaniu wywaliło deploy
 * 24 i 25 września: `fetchCityPrice` przeliczała komplet median dla jednego
 * miasta, więc budowanie jedenastu stron miejskich oznaczało około dwudziestu
 * pięciu pełnych przebiegów po mieszkaniach Otodomu - 37 sekund przy spokojnej
 * bazie, więcej niż limit Next przy obciążonej.
 */
export async function fetchCityPrices(supabase: SupabaseClient): Promise<CityPrices[]> {
  const { data, error } = await supabase
    .from('city_prices_snapshot')
    .select('cities')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    console.error('Nie udało się odczytać cen miast:', error?.message);
    return [];
  }

  return ((data.cities as any[]) ?? []).map((r) => ({
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
