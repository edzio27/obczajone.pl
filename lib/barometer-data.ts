import type { SupabaseClient } from '@supabase/supabase-js';

export type BarometerOverview = {
  activeListings: number;
  droppedListings: number;
  dropShare: number;
  medianDaysToDrop: number | null;
  daysSample: number;
};

export type ModelDrop = {
  brand: string;
  model: string;
  drops: number;
  listingsTotal: number;
  medianDropPercent: number;
};

export type DropBucket = { bucket: string; listings: number };

/**
 * Liczby na stronę „Barometr obniżek".
 *
 * Wszystko liczy baza, my odbieramy kilkanaście wierszy. To nie jest
 * przedwczesna optymalizacja: mediana wyliczana w Next.js z pobranej historii
 * cen wyczerpała 7 września budżet Disk IO tej instancji, bo ~90 stron modeli
 * przeciągało przez sieć całą tabelę snapshotów co godzinę. Tutaj to samo
 * pytanie kosztuje jedno zapytanie agregujące.
 */
export async function fetchBarometer(supabase: SupabaseClient): Promise<{
  overview: BarometerOverview | null;
  byModel: ModelDrop[];
  distribution: DropBucket[];
}> {
  const [overviewRes, modelRes, distRes] = await Promise.all([
    supabase.rpc('barometer_overview'),
    supabase.rpc('barometer_by_model'),
    supabase.rpc('barometer_distribution'),
  ]);

  const o = overviewRes.data?.[0];

  return {
    overview: o
      ? {
          activeListings: Number(o.active_listings),
          droppedListings: Number(o.dropped_listings),
          dropShare: Number(o.drop_share),
          medianDaysToDrop: o.median_days_to_drop == null ? null : Number(o.median_days_to_drop),
          daysSample: Number(o.days_sample),
        }
      : null,
    byModel: (modelRes.data ?? []).map((r: any) => ({
      brand: r.brand,
      model: r.model,
      drops: Number(r.drops),
      listingsTotal: Number(r.listings_total),
      medianDropPercent: Number(r.median_drop_percent),
    })),
    distribution: (distRes.data ?? []).map((r: any) => ({
      bucket: r.bucket,
      listings: Number(r.listings),
    })),
  };
}
