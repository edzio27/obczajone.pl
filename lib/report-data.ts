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
};

export type ModelReport = {
  name: string;
  watched: number;
  droppedPct: number;
  medianDropPct: number | null;
  medianDropPln: number | null;
};

/*
  Jedna ponowna próba przy błędzie połączenia.

  Build prerenderuje tę stronę, a przy budowaniu potrafi urwać się połączenie do
  Supabase ("TypeError: terminated" w logach) - wtedy funkcja oddawała null,
  strona chowała sekcję z liczbami i szła na produkcję jako materiał prasowy bez
  ani jednej liczby. To najgorszy możliwy tryb awarii dla tej akurat strony:
  wygląda poprawnie i nie mówi nic.
*/
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`${label}: próba ${attempt} nie powiodła się`, error);
      if (attempt === 2) return null;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return null;
}

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

export async function fetchReport(supabase: SupabaseClient): Promise<Report | null> {
  const data = await withRetry(async () => {
    const { data, error } = await supabase.rpc('price_drop_report', {
      min_days: REPORT_MIN_DAYS,
    });
    if (error) throw new Error(error.message);
    return data as any[] | null;
  }, 'Raport obniżek');

  if (!data || data.length === 0) return null;

  const rows = data.map(row);

  return {
    otomoto: rows.find((r) => r.source === 'otomoto') ?? null,
    otodom: rows.find((r) => r.source === 'otodom') ?? null,
    snapshots: Number((data as any[])[0].snapshots),
    observedDays: Number((data as any[])[0].observed_days),
  };
}

export async function fetchModelReport(supabase: SupabaseClient): Promise<ModelReport[]> {
  const data = await withRetry(async () => {
    const { data, error } = await supabase.rpc('model_drop_report', {
      min_days: REPORT_MIN_DAYS,
      min_sample: REPORT_MIN_SAMPLE,
    });
    if (error) throw new Error(error.message);
    return data as any[] | null;
  }, 'Rozbicie na modele');

  return (data ?? []).map((r: any) => ({
    name: `${r.brand} ${r.model}`,
    watched: Number(r.watched),
    droppedPct: Number(r.dropped_pct),
    medianDropPct: r.median_drop_pct == null ? null : Number(r.median_drop_pct),
    medianDropPln: r.median_drop_pln == null ? null : Number(r.median_drop_pln),
  }));
}
