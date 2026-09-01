import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ArrowUpRight, MapPin, Sparkles, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { ListingThumbnail } from '@/components/listing-thumbnail';
import { cn } from '@/lib/utils';

type ListingCardProps = {
  id: string;
  title: string | null;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string | null;
  average_rating?: number;
  review_count?: number;
  ai_opinion_rating?: number | null;
  priceChangePercent?: number | null;
  userReview?: {
    rating: number;
    comment: string;
    created_at: string;
  };
};

/**
 * Obniżka ceny to najmocniejszy powód, żeby w ogóle kliknąć w kartę - dlatego
 * jako jedyna informacja na miniaturze dostaje pełne tło, a nie sam tekst.
 */
function PriceChangePill({ percent }: { percent: number }) {
  if (percent === 0) return null;

  const dropped = percent < 0;
  const Icon = dropped ? TrendingDown : TrendingUp;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold shadow-soft backdrop-blur-sm',
        dropped ? 'bg-success text-success-foreground' : 'bg-white/90 text-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {dropped ? '' : '+'}
      {percent.toFixed(0)}%
    </span>
  );
}

export function ListingCard({
  id,
  title,
  location,
  current_price,
  source,
  created_at,
  image_url,
  average_rating,
  review_count = 0,
  ai_opinion_rating,
  priceChangePercent,
  userReview,
}: ListingCardProps) {
  const hasHumanReviews = !!average_rating && review_count > 0;
  const hasAiOnly = !hasHumanReviews && ai_opinion_rating != null;
  const displayRating = hasHumanReviews ? average_rating! : ai_opinion_rating!;

  return (
    <Link href={`/listing/${id}`} className="group block h-full">
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 ease-spring hover:-translate-y-1 hover:border-primary/35 hover:shadow-lift">
        <div className="flex gap-4 p-3.5">
          <div className="relative h-[104px] w-[104px] sm:h-[124px] sm:w-[124px] flex-shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
            <ListingThumbnail src={image_url} alt={title || 'Zdjęcie ogłoszenia'} />
            {priceChangePercent != null && priceChangePercent !== 0 && (
              <span className="absolute left-1.5 top-1.5">
                <PriceChangePill percent={priceChangePercent} />
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
                {source}
              </Badge>

              {(hasHumanReviews || hasAiOnly) && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                    hasAiOnly ? 'bg-primary/10 text-primary' : 'bg-warning/15 text-foreground'
                  )}
                  title={hasAiOnly ? 'Ocena wystawiona przez AI' : 'Średnia ocena kupujących'}
                >
                  {hasAiOnly ? (
                    <Sparkles className="h-3 w-3" />
                  ) : (
                    <Star className="h-3 w-3 fill-warning text-warning" />
                  )}
                  {displayRating.toFixed(1)}
                  {hasHumanReviews && (
                    <span className="font-medium text-muted-foreground">({review_count})</span>
                  )}
                </span>
              )}
            </div>

            <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
              {title || 'Brak tytułu'}
            </h3>

            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {location || 'Brak lokalizacji'}
            </p>

            <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
              <div>
                {current_price > 0 ? (
                  <p className="text-lg font-extrabold tabular text-foreground">
                    {current_price.toLocaleString('pl-PL')}
                    <span className="ml-1 text-sm font-bold text-muted-foreground">zł</span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">Cena niedostępna</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(created_at), {
                    addSuffix: true,
                    locale: pl,
                  })}
                </p>
              </div>

              <span className="icon-tile h-8 w-8 bg-muted text-muted-foreground transition-all duration-300 ease-spring group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>

        {userReview && (
          <div className="border-t bg-muted/40 px-3.5 py-3">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground">Twoja ocena</span>
              <span className="inline-flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < userReview.rating ? 'fill-warning text-warning' : 'text-border'
                    )}
                  />
                ))}
              </span>
            </div>
            <p className="line-clamp-2 text-xs italic text-muted-foreground">
              &bdquo;{userReview.comment}&rdquo;
            </p>
          </div>
        )}
      </article>
    </Link>
  );
}
