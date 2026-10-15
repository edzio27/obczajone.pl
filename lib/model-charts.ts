import type { SupabaseClient } from '@supabase/supabase-js';
import { ponawiaj, trwaBudowanie } from './retry';
import type { IndexPoint, RecentDrop } from './market-trends';

/**
 * Dane do wykresów na stronie modelu, liczone nocą do `model_price_charts`
 * (migracja 20261015120000). Jeden wiersz na model.
 */
export type ModelCharts = {
  index: IndexPoint[];
  byYear: { year: number; median: number; n: number }[];
  /** `from` to dolna granica przedziału przebiegu w km (co 50 tys., ostatni otwarty). */
  byMileage: { from: number; median: number; n: number }[];
  distribution: { from: number; to: number; n: number }[];
  recentDrops: RecentDrop[];
};

export async function fetchModelCharts(
  supabase: SupabaseClient,
  brand: string,
  model: string
): Promise<ModelCharts | null> {
  const { data, error } = await ponawiaj('Wykresy modelu', async (sygnal) =>
    supabase
      .from('model_price_charts')
      .select('data')
      .eq('brand', brand)
      .eq('model', model)
      .abortSignal(sygnal)
      .maybeSingle()
  );

  if (error) {
    if (trwaBudowanie()) return null;
    throw new Error(`Nie udało się odczytać wykresów ${brand} ${model}: ${error.message}`);
  }
  if (!data?.data) return null;

  const raw = data.data as any;
  return {
    index: (raw.index ?? []).map((p: any) => ({ week: p.week, value: Number(p.value), n: Number(p.n) })),
    byYear: (raw.by_year ?? []).map((p: any) => ({
      year: Number(p.year),
      median: Number(p.median),
      n: Number(p.n),
    })),
    byMileage: (raw.by_mileage ?? []).map((p: any) => ({
      from: Number(p.from),
      median: Number(p.median),
      n: Number(p.n),
    })),
    distribution: (raw.distribution ?? []).map((p: any) => ({
      from: Number(p.from),
      to: Number(p.to),
      n: Number(p.n),
    })),
    recentDrops: (raw.recent_drops ?? []).map((d: any) => ({
      id: d.id,
      title: d.title,
      imageUrl: d.image_url || null,
      brand,
      model,
      fromPrice: Number(d.from_price),
      toPrice: Number(d.to_price),
      changedAt: d.changed_at,
    })),
  };
}
