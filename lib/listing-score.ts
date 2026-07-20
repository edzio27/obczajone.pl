export type ScoreLevel = 'green' | 'yellow' | 'red';

export type ListingScoreRow = {
  level: ScoreLevel;
  label: string;
  points: number;
  maxPoints: number;
};

export type ListingScoreInput = {
  priceChangePercent: number | null;
  averageRating: number | null;
  reviewCount: number;
  hasReportedReview: boolean;
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

function reviewCountLabel(count: number): string {
  const noun = count === 1 ? 'opinia' : count < 5 ? 'opinie' : 'opinii';
  return `${count} ${noun}`;
}

export function computeListingScore(input: ListingScoreInput): ListingScore {
  const {
    priceChangePercent,
    averageRating,
    reviewCount,
    hasReportedReview,
    isActive,
    daysSinceFirstSeen,
  } = input;

  const priceScore =
    priceChangePercent == null ? 25 : clamp(30 - priceChangePercent * 1.5, 5, 40);

  const reviewScore =
    reviewCount === 0
      ? 20
      : hasReportedReview
        ? Math.max(0, ((averageRating ?? 0) / 5) * 40 - 10)
        : ((averageRating ?? 0) / 5) * 40;

  const activityScore = isActive ? 20 : 10;

  const total = Math.round(priceScore + reviewScore + activityScore);

  const priceScoreRounded = Math.round(priceScore);
  const reviewScoreRounded = Math.round(reviewScore);

  const priceRow: ListingScoreRow =
    priceChangePercent == null || priceChangePercent === 0
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
    reviewCount === 0
      ? { level: 'yellow', label: 'Brak opinii', points: reviewScoreRounded, maxPoints: 40 }
      : hasReportedReview
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
              };

  const activityRow: ListingScoreRow = isActive
    ? {
        level: 'green',
        label: `Aktywne od ${daysSinceFirstSeen} dni`,
        points: activityScore,
        maxPoints: 20,
      }
    : { level: 'yellow', label: 'Zdjęte z rynku', points: activityScore, maxPoints: 20 };

  const level: ScoreLevel = total >= 70 ? 'green' : total >= 40 ? 'yellow' : 'red';

  return {
    total,
    level,
    rows: { price: priceRow, reviews: reviewsRow, activity: activityRow },
  };
}
