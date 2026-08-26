export type ScoreLevel = 'green' | 'yellow' | 'red';

export type ListingScoreRow = {
  level: ScoreLevel;
  label: string;
  points: number;
  maxPoints: number;
};

export type ListingScoreInput = {
  priceChangePercent: number | null;
  /** Odchylenie od mediany podobnych ofert w procentach. Ujemne = taniej. */
  priceVsMedianPercent: number | null;
  /** Czy porównanie było ścisłe na tyle, żeby uzasadniać ostrzeżenie. */
  priceComparisonStrict: boolean;
  averageRating: number | null;
  reviewCount: number;
  hasReportedReview: boolean;
  aiOpinionRating: number | null;
  isActive: boolean;
  daysSinceFirstSeen: number;
};

export type ListingScore = {
  total: number;
  level: ScoreLevel;
  rows: {
    price: ListingScoreRow;
    reviews: ListingScoreRow;
    activity: ListingScoreRow;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const NOISE_THRESHOLD_PERCENT = 5;
const BARGAIN_THRESHOLD_PERCENT = -15;
const SUSPICIOUS_THRESHOLD_PERCENT = -25;
const PRICEY_THRESHOLD_PERCENT = 20;

function scoreAgainstMedian(percent: number): number {
  if (percent <= SUSPICIOUS_THRESHOLD_PERCENT) return 12;
  if (percent <= BARGAIN_THRESHOLD_PERCENT) return 26;
  if (percent < -NOISE_THRESHOLD_PERCENT) return 40;
  if (percent <= NOISE_THRESHOLD_PERCENT) return 35;
  if (percent <= PRICEY_THRESHOLD_PERCENT) return 25;
  return 16;
}

function marketPriceRow(percent: number, strict: boolean): ListingScoreRow {
  const points = scoreAgainstMedian(percent);
  const away = Math.abs(percent).toFixed(0);

  if (percent <= SUSPICIOUS_THRESHOLD_PERCENT) {
    // Bez ścisłego dopasowania duże odchylenie równie dobrze może wynikać z tego,
    // że porównaliśmy inną wersję silnika albo starszy rocznik. To za słaba
    // podstawa, żeby oznaczyć czyjeś ogłoszenie jako podejrzane.
    return strict
      ? {
          level: 'red',
          label: `${away}% poniżej mediany — duża różnica, sprawdź stan i historię`,
          points,
          maxPoints: 40,
        }
      : {
          level: 'yellow',
          label: `${away}% poniżej mediany dla tego modelu — porównanie orientacyjne`,
          points: Math.max(points, 22),
          maxPoints: 40,
        };
  }

  if (percent <= BARGAIN_THRESHOLD_PERCENT) {
    return {
      level: 'yellow',
      label: `${away}% poniżej mediany — warto dopytać, skąd ta różnica`,
      points,
      maxPoints: 40,
    };
  }

  if (percent < -NOISE_THRESHOLD_PERCENT) {
    return { level: 'green', label: `${away}% poniżej mediany`, points, maxPoints: 40 };
  }

  if (percent <= NOISE_THRESHOLD_PERCENT) {
    return {
      level: 'green',
      label: 'Cena typowa dla tego modelu',
      points,
      maxPoints: 40,
    };
  }

  return {
    level: 'yellow',
    label: `${away}% powyżej mediany`,
    points,
    maxPoints: 40,
  };
}

function reviewCountLabel(count: number): string {
  const noun = count === 1 ? 'opinia' : count < 5 ? 'opinie' : 'opinii';
  return `${count} ${noun}`;
}

export function computeListingScore(input: ListingScoreInput): ListingScore {
  const {
    priceChangePercent,
    priceVsMedianPercent,
    priceComparisonStrict,
    averageRating,
    reviewCount,
    hasReportedReview,
    aiOpinionRating,
    isActive,
    daysSinceFirstSeen,
  } = input;

  // Porownanie z mediana jest mocniejszym sygnalem niz sama historia ceny, wiec
  // gdy je mamy, to ono decyduje o tym wierszu.
  //
  // Uwaga na kierunek: cena mocno ponizej rynku NIE jest automatycznie dobra.
  // Przy autach uzywanych to klasyczny sygnal powypadkowego stanu, cofnietego
  // przebiegu albo oszustwa - i wlasnie wtedy warto obejrzec auto z fachowcem.
  const priceScore =
    priceVsMedianPercent != null
      ? scoreAgainstMedian(priceVsMedianPercent)
      : priceChangePercent == null
        ? 25
        : clamp(30 - priceChangePercent * 1.5, 5, 40);

  const reviewScore =
    reviewCount > 0
      ? hasReportedReview
        ? Math.max(0, ((averageRating ?? 0) / 5) * 40 - 10)
        : ((averageRating ?? 0) / 5) * 40
      : aiOpinionRating != null
        ? (aiOpinionRating / 5) * 40
        : 20;

  const activityScore = isActive ? 20 : 10;

  const total = Math.round(priceScore + reviewScore + activityScore);

  const priceScoreRounded = Math.round(priceScore);
  const reviewScoreRounded = Math.round(reviewScore);

  const priceRow: ListingScoreRow = priceVsMedianPercent != null
    ? marketPriceRow(priceVsMedianPercent, priceComparisonStrict)
    : priceChangePercent == null || priceChangePercent === 0
      ? {
          level: 'yellow',
          label: priceChangePercent === 0 ? 'Cena bez zmian' : 'Za mało danych o cenie',
          points: priceScoreRounded,
          maxPoints: 40,
        }
      : priceChangePercent < 0
        ? {
            level: 'green',
            label: `Cena spadła o ${Math.abs(priceChangePercent).toFixed(0)}%`,
            points: priceScoreRounded,
            maxPoints: 40,
          }
        : {
            level: 'red',
            label: `Cena wzrosła o ${priceChangePercent.toFixed(0)}%`,
            points: priceScoreRounded,
            maxPoints: 40,
          };

  const reviewsRow: ListingScoreRow =
    reviewCount > 0
      ? hasReportedReview
        ? {
            level: 'red',
            label: 'Jedna z opinii została zgłoszona',
            points: reviewScoreRounded,
            maxPoints: 40,
          }
        : (averageRating ?? 0) >= 4
          ? {
              level: 'green',
              label: `Ocena ${averageRating!.toFixed(1)}/5 z ${reviewCountLabel(reviewCount)}`,
              points: reviewScoreRounded,
              maxPoints: 40,
            }
          : (averageRating ?? 0) >= 2.5
            ? {
                level: 'yellow',
                label: `Ocena ${averageRating!.toFixed(1)}/5 z ${reviewCountLabel(reviewCount)}`,
                points: reviewScoreRounded,
                maxPoints: 40,
              }
            : {
                level: 'red',
                label: `Ocena ${averageRating!.toFixed(1)}/5 z ${reviewCountLabel(reviewCount)}`,
                points: reviewScoreRounded,
                maxPoints: 40,
              }
      : aiOpinionRating != null
        ? aiOpinionRating >= 4
          ? {
              level: 'green',
              label: `Opinia AI ${aiOpinionRating.toFixed(1)}/5`,
              points: reviewScoreRounded,
              maxPoints: 40,
            }
          : aiOpinionRating >= 2.5
            ? {
                level: 'yellow',
                label: `Opinia AI ${aiOpinionRating.toFixed(1)}/5`,
                points: reviewScoreRounded,
                maxPoints: 40,
              }
            : {
                level: 'red',
                label: `Opinia AI ${aiOpinionRating.toFixed(1)}/5`,
                points: reviewScoreRounded,
                maxPoints: 40,
              }
        : { level: 'yellow', label: 'Brak opinii', points: reviewScoreRounded, maxPoints: 40 };

  const activityRow: ListingScoreRow = isActive
    ? {
        level: 'green',
        label: `Aktywne od ${daysSinceFirstSeen} dni`,
        points: activityScore,
        maxPoints: 20,
      }
    : { level: 'yellow', label: 'Zdjęte z rynku', points: activityScore, maxPoints: 20 };

  // Pojedynczy powazny sygnal ostrzegawczy nie moze zniknac w sredniej. Cena 40%
  // ponizej rynku znaczy cos niezaleznie od tego, ze ogloszenie jest aktywne, a
  // model jezykowy wystawil mu cztery gwiazdki.
  const hasRedRow =
    priceRow.level === 'red' || reviewsRow.level === 'red' || activityRow.level === 'red';

  const level: ScoreLevel = hasRedRow
    ? 'red'
    : total >= 70
      ? 'green'
      : total >= 40
        ? 'yellow'
        : 'red';

  return {
    total,
    level,
    rows: { price: priceRow, reviews: reviewsRow, activity: activityRow },
  };
}
