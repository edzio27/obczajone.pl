import type { PriceComparison } from './price-comparison';
import type { ModelTrend } from './price-trends';

/**
 * Ocena ceny i propozycja na start negocjacji.
 *
 * Łączy dwie rzeczy, które do tej pory leżały osobno: medianę podobnych ofert
 * (`price-comparison`) i to, jak sprzedający danego modelu faktycznie schodzą
 * z ceny (`model_trends_snapshot`). Pierwsza mówi, czy cena odstaje. Druga mówi,
 * ile da się utargować, a o to kupujący pyta naprawdę. Otomoto tego nie pokaże,
 * bo nie leży to w interesie sprzedających.
 *
 * Wszystko tu to ceny ofertowe z naszej bazy, nie transakcyjne. Karta musi to
 * mówić, a propozycja jest punktem wyjścia do rozmowy, nie wyceną.
 */

/** Poniżej tego progu różnica od mediany jest szumem. Ten sam co w karcie porównania. */
const MEANINGFUL_DIFFERENCE_PERCENT = 3;

/**
 * Od ilu ofert wolno mówić o kwartylach („taniej niż 3 na 4”). Przy pięciu
 * autach kwartyl to jedno auto, a etykieta brzmi jak reguła rynku.
 */
const MIN_SAMPLE_FOR_QUARTILE_LABEL = 12;

/** Propozycję zaokrąglamy w dół do takiej kwoty, bo tak rozmawia się o cenie auta. */
const ROUND_TO_PLN = 500;

export type VerdictLevel = 'okazja' | 'ponizej' | 'rynkowa' | 'powyzej' | 'wysoka';

export type PriceVerdict = {
  level: VerdictLevel;
  /** Krótka etykieta do nagłówka karty. */
  label: string;
  percentVsMedian: number;
};

export type NegotiationHint = {
  /** Ile ogłoszeń modelu w ogóle staniało w czasie obserwacji, w procentach. */
  shareDroppedPercent: number;
  /** Mediana obniżki modelu wśród tych, które staniały. */
  typicalDropPercent: number;
  /** O ile ten sprzedający już zszedł od pierwszej ceny, którą widzieliśmy. */
  alreadyDroppedPercent: number;
  /** Czy sprzedający zszedł już co najmniej tyle, ile typowo schodzi się przy tym modelu. */
  alreadyAtTypical: boolean;
  /** Propozycja na start rozmowy, zaokrąglona w dół. */
  suggestedOffer: number;
  /** Różnica między ceną a propozycją. */
  suggestedDiscount: number;
};

export type PriceAssessment = {
  verdict: PriceVerdict | null;
  negotiation: NegotiationHint | null;
};

export function assessPriceVerdict(
  currentPrice: number,
  comparison: PriceComparison | null
): PriceVerdict | null {
  if (!comparison?.sufficient || comparison.percentVsMedian == null) return null;

  /*
    Luźne dopasowanie (sam model, rocznik ±3 lata) wrzuca do jednego worka
    Octavię 1.0 TSI i Octavię RS plug-in. Taka mediana wystarcza za orientację,
    ale werdykt „56% powyżej mediany” byłby nieprawdą o tym konkretnym aucie,
    a argument „podobne oferty kosztują mniej” wprowadzałby kupującego w błąd.
  */
  if (!comparison.strict) return null;

  const percent = comparison.percentVsMedian;
  const p25 = comparison.lowerQuartile;
  const p75 = comparison.upperQuartile;
  const quartilesMeaningful = comparison.sampleSize >= MIN_SAMPLE_FOR_QUARTILE_LABEL;

  /*
    „Okazja” i „wysoka” wymagają próbki, na której kwartyl coś znaczy. To
    etykiety, z którymi ktoś pojedzie po auto albo odpuści ofertę.
  */
  if (quartilesMeaningful && p25 != null && currentPrice < p25) {
    return { level: 'okazja', label: 'Tańsza niż 3 na 4 podobne oferty', percentVsMedian: percent };
  }
  if (quartilesMeaningful && p75 != null && currentPrice > p75) {
    return { level: 'wysoka', label: 'Droższa niż 3 na 4 podobne oferty', percentVsMedian: percent };
  }
  if (percent < -MEANINGFUL_DIFFERENCE_PERCENT) {
    return { level: 'ponizej', label: `${Math.abs(percent).toFixed(0)}% poniżej mediany`, percentVsMedian: percent };
  }
  if (percent > MEANINGFUL_DIFFERENCE_PERCENT) {
    return { level: 'powyzej', label: `${percent.toFixed(0)}% powyżej mediany`, percentVsMedian: percent };
  }
  return { level: 'rynkowa', label: 'Cena rynkowa', percentVsMedian: percent };
}

export function assessNegotiation(
  currentPrice: number,
  firstPrice: number | null,
  trend: ModelTrend | null
): NegotiationHint | null {
  if (!trend || trend.medianDropPercent == null || trend.sampleSize <= 0) return null;
  if (!(currentPrice > 0)) return null;

  const typical = trend.medianDropPercent;
  const alreadyDropped =
    firstPrice != null && firstPrice > currentPrice
      ? ((firstPrice - currentPrice) / firstPrice) * 100
      : 0;
  const alreadyAtTypical = alreadyDropped >= typical;

  /*
    Jeśli sprzedający już zszedł o typową kwotę, nie udajemy, że drugie tyle
    jest w zasięgu: proponujemy połowę typowej obniżki od dzisiejszej ceny.
    W przeciwnym razie tyle, ile brakuje mu do typowej, licząc od pierwszej
    ceny, ale nie mniej niż połowę typowej, żeby propozycja miała sens.
  */
  const remaining = alreadyAtTypical
    ? typical / 2
    : Math.max(typical - alreadyDropped, typical / 2);

  const raw = currentPrice * (1 - remaining / 100);
  const suggestedOffer = Math.floor(raw / ROUND_TO_PLN) * ROUND_TO_PLN;
  const suggestedDiscount = currentPrice - suggestedOffer;

  // Przy tanich autach zaokrąglenie potrafi zjeść całą różnicę albo ją podwoić.
  // Wtedy lepiej nie pokazywać kwoty niż pokazać dziwną.
  if (suggestedDiscount <= 0 || suggestedDiscount > currentPrice * (typical / 100) * 1.5) {
    return null;
  }

  return {
    shareDroppedPercent: (trend.droppedCount / trend.sampleSize) * 100,
    typicalDropPercent: typical,
    alreadyDroppedPercent: alreadyDropped,
    alreadyAtTypical,
    suggestedOffer,
    suggestedDiscount,
  };
}

/**
 * Krótkie etykiety na kafelki. Na stronie ogłoszenia jest miejsce na „12%
 * poniżej mediany”, na kafelku nie - tam liczy się, czy w ogóle warto kliknąć.
 */
export const VERDICT_BADGE: Record<VerdictLevel, { label: string; hint: string; tone: 'great' | 'good' | 'neutral' | 'high' | 'veryHigh' }> = {
  okazja: { label: 'Super cena', hint: 'Tańsza niż 3 na 4 podobne oferty', tone: 'great' },
  ponizej: { label: 'Dobra cena', hint: 'Ponad 3% poniżej mediany podobnych ofert', tone: 'good' },
  rynkowa: { label: 'Cena rynkowa', hint: 'W granicach 3% od mediany podobnych ofert', tone: 'neutral' },
  powyzej: { label: 'Powyżej rynku', hint: 'Ponad 3% powyżej mediany podobnych ofert', tone: 'high' },
  wysoka: { label: 'Wysoka cena', hint: 'Droższa niż 3 na 4 podobne oferty', tone: 'veryHigh' },
};

export function isVerdictLevel(value: unknown): value is VerdictLevel {
  return typeof value === 'string' && value in VERDICT_BADGE;
}
