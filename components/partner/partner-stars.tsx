import { Star } from 'lucide-react';
import { formatRating, reviewCountLabel } from '@/lib/partner-data';

type PartnerStarsProps = {
  rating: number | null;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Bez ocen pokazujemy wprost "brak opinii" zamiast pustych gwiazdek udających zero. */
  showEmptyLabel?: boolean;
};

const SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function PartnerStars({ rating, count, size = 'md', showEmptyLabel = true }: PartnerStarsProps) {
  if (rating == null || (count != null && count === 0)) {
    if (!showEmptyLabel) return null;
    return <span className="text-sm text-muted-foreground">Brak opinii</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${SIZES[size]} ${
              star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-foreground">{formatRating(rating)}</span>
      {count != null && (
        <span className="text-sm text-muted-foreground">({reviewCountLabel(count)})</span>
      )}
    </span>
  );
}
