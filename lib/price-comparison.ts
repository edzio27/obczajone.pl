import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Porównanie ceny ogłoszenia z podobnymi ofertami w bazie.
 *
 * To jedyny sygnał w serwisie, którego użytkownik nie sprawdzi sam i którego nie
 * wygeneruje model językowy - opinia AI powstaje bez dostępu do innych ofert,
 * więc z definicji nie potrafi powiedzieć, czy cena odstaje od rynku.
 */

/** Poniżej tylu porównywalnych ofert mediana nie znaczy nic i jej nie pokazujemy. */
const MIN_SAMPLE_SIZE = 5;

/** Ile ofert maksymalnie pobieramy do policzenia mediany. */
const CANDIDATE_LIMIT = 500;

/**
 * Górny kwartyl podzielony przez dolny. Powyżej tej wartości porównywane oferty
 * są tak różne, że mediana przestaje cokolwiek znaczyć - typowo dzieje się tak,
 * gdy jeden model obejmuje kilkanaście roczników (BMW Seria 3 z 2006 i z 2023 w
 * jednym worku). Wtedy wolimy powiedzieć "za mało danych" niż podać liczbę,
 * na podstawie której ktoś negocjuje cenę auta.
 */
const MAX_QUARTILE_SPREAD = 2;

export type CarSpecs = {
  brand: string | null;
  model: string | null;
  year: string | number | null;
  mileage: string | number | null;
  fuel_type: string | null;
};

export type PriceComparison = {
  /** Czy próbka jest wystarczająca, żeby cokolwiek twierdzić. */
  sufficient: boolean;
  sampleSize: number;
  medianPrice: number | null;
  /** Różnica ceny tego ogłoszenia względem mediany, w procentach. Ujemna = taniej. */
  percentVsMedian: number | null;
  lowerQuartile: number | null;
  upperQuartile: number | null;
  /** Czytelny opis tego, co porównywaliśmy - bez tego liczba jest nieweryfikowalna. */
  criteriaLabel: string;
  /**
   * Czy dopasowanie było na tyle ścisłe, żeby oprzeć na nim ostrzeżenie.
   * Porównanie "ten sam model, dowolny rocznik" wystarcza za orientację, ale nie
   * za podstawę do oznaczenia ogłoszenia jako podejrzanego.
   */
  strict: boolean;
};

/** Otomoto zapisuje parametry jako tekst, więc nie ufamy typom. */
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

type Candidate = { price: number; year: number | null; mileage: number | null; fuel: string | null };

/**
 * Kolejne poziomy dopasowania, od najostrzejszego. Schodzimy niżej dopiero, gdy
 * wyżej brakuje ofert - lepiej porównać do szerszej grupy i powiedzieć o tym
 * wprost, niż policzyć medianę z dwóch aut.
 */
type MatchLevel = {
  label: (base: string) => string;
  matches: (c: Candidate, subject: Candidate) => boolean;
  strict: boolean;
};

const MATCH_LEVELS: MatchLevel[] = [
  {
    label: (base) => `${base}, rocznik ±2 lata, ten sam rodzaj paliwa, przebieg ±40%`,
    matches: (c, s) => yearWithin(c, s, 2) && sameFuel(c, s) && mileageWithin(c, s, 0.4),
    strict: true,
  },
  {
    label: (base) => `${base}, rocznik ±2 lata, ten sam rodzaj paliwa`,
    matches: (c, s) => yearWithin(c, s, 2) && sameFuel(c, s),
    strict: true,
  },
  {
    label: (base) => `${base}, rocznik ±3 lata`,
    matches: (c, s) => yearWithin(c, s, 3),
    strict: false,
  },
];

function yearWithin(c: Candidate, s: Candidate, tolerance: number): boolean {
  if (c.year == null || s.year == null) return false;
  return Math.abs(c.year - s.year) <= tolerance;
}

function sameFuel(c: Candidate, s: Candidate): boolean {
  if (!c.fuel || !s.fuel) return false;
  return c.fuel.toLowerCase() === s.fuel.toLowerCase();
}

function mileageWithin(c: Candidate, s: Candidate, tolerance: number): boolean {
  if (c.mileage == null || s.mileage == null || s.mileage === 0) return false;
  return Math.abs(c.mileage - s.mileage) / s.mileage <= tolerance;
}

function toCandidate(row: { current_price: number; specs: CarSpecs | null }): Candidate {
  const specs = row.specs ?? ({} as CarSpecs);
  return {
    price: Number(row.current_price),
    year: parseNumber(specs.year),
    mileage: parseNumber(specs.mileage),
    fuel: specs.fuel_type ?? null,
  };
}

export async function fetchPriceComparison(
  supabase: SupabaseClient,
  listing: { id: string; source: string; current_price: number; specs: CarSpecs | null }
): Promise<PriceComparison | null> {
  if (listing.source !== 'otomoto') return null;

  const specs = listing.specs;
  const brand = specs?.brand?.trim();
  const model = specs?.model?.trim();

  // Bez marki i modelu nie ma czego z czym porównywać. Zgadywanie z tytułu dawało
  // "Bezpośrednio" albo "Przestronne" jako markę, więc tego nie robimy.
  if (!brand || !model || !(listing.current_price > 0)) return null;

  const { data, error } = await supabase
    .from('listings')
    .select('id, current_price, specs')
    .eq('source', 'otomoto')
    .neq('id', listing.id)
    .gt('current_price', 0)
    .filter('specs->>brand', 'eq', brand)
    .filter('specs->>model', 'eq', model)
    .limit(CANDIDATE_LIMIT);

  if (error || !data || data.length === 0) return null;

  const subject = toCandidate({ current_price: listing.current_price, specs });
  const candidates = data.map((row: any) => toCandidate(row));
  const baseLabel = `${brand} ${model}`;

  for (const level of MATCH_LEVELS) {
    const matched = candidates.filter((c) => level.matches(c, subject));

    if (matched.length >= MIN_SAMPLE_SIZE) {
      const prices = matched.map((c) => c.price).sort((a, b) => a - b);
      const med = median(prices);
      const p25 = quantile(prices, 0.25);
      const p75 = quantile(prices, 0.75);

      // Zbyt rozstrzelone ceny - schodzimy niżej nie ma sensu (kolejne poziomy
      // są tylko luźniejsze), więc kończymy z informacją o braku danych.
      if (p25 > 0 && p75 / p25 > MAX_QUARTILE_SPREAD) {
        break;
      }

      return {
        sufficient: true,
        sampleSize: matched.length,
        medianPrice: med,
        percentVsMedian: med > 0 ? ((listing.current_price - med) / med) * 100 : null,
        lowerQuartile: p25,
        upperQuartile: p75,
        criteriaLabel: level.label(baseLabel),
        strict: level.strict,
      };
    }
  }

  // Mamy jakieś oferty tego modelu, ale za mało na medianę. Mówimy to wprost,
  // zamiast pokazywać liczbę, której nie da się obronić.
  return {
    sufficient: false,
    sampleSize: candidates.length,
    medianPrice: null,
    percentVsMedian: null,
    lowerQuartile: null,
    upperQuartile: null,
    criteriaLabel: baseLabel,
    strict: false,
  };
}
