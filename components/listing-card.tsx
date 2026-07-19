import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ImageOff, Star, TrendingDown, TrendingUp } from 'lucide-react';

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
  priceChangePercent?: number | null;
  userReview?: {
    rating: number;
    comment: string;
    created_at: string;
  };
};

function PriceChangeBadge({ percent }: { percent: number }) {
  if (percent === 0) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        Cena bez zmian
      </span>
    );
  }
  const dropped = percent < 0;
  const Icon = dropped ? TrendingDown : TrendingUp;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        dropped ? 'text-success' : 'text-warning'
      }`}
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
  priceChangePercent,
  userReview,
}: ListingCardProps) {
  const getStarRating = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  return (
    <Link href={`/listing/${id}`}>
      <Card className="group hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer h-full border-gray-200 hover:-translate-y-1 overflow-hidden">
        <div className="flex gap-4 p-4">
          <div className="w-[154px] h-[154px] flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
            {image_url ? (
              <img
                src={image_url}
                alt={title || 'Zdjęcie ogłoszenia'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <ImageOff className="h-6 w-6 text-gray-300" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge
                variant={source === 'otomoto' ? 'default' : 'secondary'}
                className="font-semibold"
              >
                {source}
              </Badge>
              {average_rating && review_count > 0 && (
                <div className="flex items-center gap-1 text-sm flex-shrink-0">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < Math.round(average_rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold">{average_rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({review_count})</span>
                </div>
              )}
            </div>

            <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {title || 'Brak tytułu'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {location || 'Brak lokalizacji'}
            </p>

            <div className="mt-auto pt-2">
              {current_price > 0 ? (
                <>
                  <p className="text-xl font-bold text-primary">
                    {current_price.toLocaleString('pl-PL')} zł
                  </p>
                  {priceChangePercent != null && (
                    <PriceChangeBadge percent={priceChangePercent} />
                  )}
                </>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">
                  Cena niedostępna
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(created_at), {
                  addSuffix: true,
                  locale: pl,
                })}
              </p>
            </div>

            {userReview && (
              <div className="pt-3 border-t mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Twoja ocena:</span>
                  <span className="text-lg">{getStarRating(userReview.rating)}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 italic">
                  &quot;{userReview.comment}&quot;
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(userReview.created_at), {
                    addSuffix: true,
                    locale: pl,
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
