import type { SupabaseClient } from '@supabase/supabase-js';
import { ponawiaj, trwaBudowanie } from './retry';

/**
 * Trendy cen rynku aut, liczone nocą przez `refresh_price_trends_snapshot`
 * (patrz migracja 20261015100000). Strona czyta jeden wiersz.
 *
 * Wszystkie zmiany cen są liczone na tych samych egzemplarzach, nie z mediany
 * całej bazy - inaczej każdy przelot po nowym modelu zmieniałby „rynek”.
 */

export type IndexPoint = { week: string; value: number; n: number };

export type TrendGroup = {
  kind: 'all' | 'body' | 'make' | 'model';
  brand: string | null;
  model: string | null;
  body: string | null;
  /** Średnia zmiana ceny tych samych aut w 30 dni, w procentach. */
  change30Percent: number;
  /** Ile aut weszło do pomiaru 30-dniowego. */
  n30: number;
  /** Jaki odsetek z nich zmienił cenę w tym czasie. */
  changedSharePercent: number;
  medianPrice: number | null;
  active: number | null;
};

export type RecentDrop = {
  id: string;
  title: string;
  imageUrl: string | null;
  brand: string;
  model: string;
  fromPrice: number;
  toPrice: number;
  changedAt: string;
};

export type MarketTrends = {
  computedAt: string;
  index: IndexPoint[];
  groups: TrendGroup[];
  recentDrops: RecentDrop[];
};

export async function fetchMarketTrends(supabase: SupabaseClient): Promise<MarketTrends | null> {
  const { data, error } = await ponawiaj('Trendy rynku', async (sygnal) =>
    supabase.from('price_trends_snapshot').select('data').eq('id', 1).abortSignal(sygnal).maybeSingle()
  );

  // Błąd odczytu to nie brak trendów: pod ISR pusta strona żyłaby godzinę.
  // Przy budowaniu przepuszczamy pustkę, żeby awaria bazy nie blokowała deployu.
  if (error) {
    if (trwaBudowanie()) return null;
    throw new Error(`Nie udało się odczytać trendów rynku: ${error.message}`);
  }
  if (!data?.data) return null;

  const raw = data.data as any;
  return {
    computedAt: raw.computed_at,
    index: (raw.index ?? []).map((p: any) => ({
      week: p.week,
      value: Number(p.value),
      n: Number(p.n),
    })),
    groups: (raw.groups ?? []).map((g: any) => ({
      kind: g.kind,
      brand: g.brand,
      model: g.model,
      body: g.body,
      change30Percent: Number(g.change30_percent),
      n30: Number(g.n30),
      changedSharePercent: Number(g.changed_share_percent),
      medianPrice: g.median_price == null ? null : Number(g.median_price),
      active: g.active == null ? null : Number(g.active),
    })),
    recentDrops: (raw.recent_drops ?? []).map((d: any) => ({
      id: d.id,
      title: d.title,
      imageUrl: d.image_url || null,
      brand: d.brand,
      model: d.model,
      fromPrice: Number(d.from_price),
      toPrice: Number(d.to_price),
      changedAt: d.changed_at,
    })),
  };
}
