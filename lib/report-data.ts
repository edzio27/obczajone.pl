import type { SupabaseClient } from '@supabase/supabase-js';

/*
  Liczby dla strony /dla-mediow.

  Wszystko liczone w bazie i pobierane jako kilka wierszy - dane mają być
  cytowane w prasie, więc nie mogą być przepisane do kodu i powoli się starzeć.
  Dziennikarz, który wraca po nie za miesiąc, dostaje stan z dzisiaj.
*/

/** Od ilu dni obserwacji oferta wchodzi do statystyki. */
export const REPORT_MIN_DAYS = 14;

/** Ile ofert musi mieć model, żeby w ogóle pokazać go w rozbiciu. */
export const REPORT_MIN_SAMPLE = 20;

export type SourceReport = {
  source: 'otomoto' | 'otodom';
  watched: number;
  dropped: number;
  droppedPct: number;
  medianDropPct: number | null;
  medianDropPln: number | null;
  /** Ile ofert zmieniło cenę co najmniej dwukrotnie. */
  multiDrop: number;
};

export type Report = {
  otomoto: SourceReport | null;
  otodom: SourceReport | null;
  /** Wszystkie zapisane stany cen, obie platformy razem. */
  snapshots: number;
  /** Ile dni temu zobaczyliśmy pierwsze ogłoszenie. */
  observedDays: number;
  /** Kiedy cron ostatnio przeliczył te liczby. Cytujący powinien to widzieć. */
  computedAt: string;
};

export type ModelReport = {
  name: string;
  watched: number;
  droppedPct: number;
  medianDropPct: number | null;
  medianDropPln: number | null;
};

function row(r: any): SourceReport {
  return {
    source: r.source,
    watched: Number(r.watched),
    dropped: Number(r.dropped),
    droppedPct: Number(r.dropped_pct),
    medianDropPct: r.median_drop_pct == null ? null : Number(r.median_drop_pct),
    medianDropPln: r.median_drop_pln == null ? null : Number(r.median_drop_pln),
    multiDrop: Number(r.multi_drop),
  };
}

/**
 * Raport czytany z gotowego wiersza, nie liczony na miejscu.
 *
 * Percentyle liczy cron o :35 i zapisuje do `report_snapshot`; tutaj zostaje
 * jeden SELECT. Trzy wcześniejsze podejścia - prerender, force-dynamic
 * i podniesiony limit czasu - przewróciły się na tym, że liczyły je w chwili,
 * gdy ktoś patrzył: raz build bez liczb, raz strona odpowiadająca 21 sekund,
 * raz zatkana pula połączeń i timeout na stronie głównej.
 */
async function readSnapshot(
  supabase: SupabaseClient
): Promise<{ sources: any[]; models: any[]; computedAt: string } | null> {
  const { data, error } = await supabase
    .from('report_snapshot')
    .select('sources, models, computed_at')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    console.error('Nie udało się odczytać raportu:', error?.message);
    return null;
  }

  return {
    sources: (data.sources as any[]) ?? [],
    models: (data.models as any[]) ?? [],
    computedAt: data.computed_at as string,
  };
}

export async function fetchReport(supabase: SupabaseClient): Promise<Report | null> {
  const snapshot = await readSnapshot(supabase);
  if (!snapshot || snapshot.sources.length === 0) return null;

  const rows = snapshot.sources.map(row);

  return {
    otomoto: rows.find((r) => r.source === 'otomoto') ?? null,
    otodom: rows.find((r) => r.source === 'otodom') ?? null,
    snapshots: Number(snapshot.sources[0].snapshots),
    observedDays: Number(snapshot.sources[0].observed_days),
    computedAt: snapshot.computedAt,
  };
}

export async function fetchModelReport(supabase: SupabaseClient): Promise<ModelReport[]> {
  const snapshot = await readSnapshot(supabase);
  if (!snapshot) return [];

  return snapshot.models.map((r: any) => ({
    name: `${r.brand} ${r.model}`,
    watched: Number(r.watched),
    droppedPct: Number(r.dropped_pct),
    medianDropPct: r.median_drop_pct == null ? null : Number(r.median_drop_pct),
    medianDropPln: r.median_drop_pln == null ? null : Number(r.median_drop_pln),
  }));
}
