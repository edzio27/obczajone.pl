import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Star } from 'lucide-react';

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
  userReview?: {
    rating: number;
    comment: string;
    created_at: string;
  };
};

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
  userReview,
}: ListingCardProps) {
  const getStarRating = (rating: number) => {
    return '⭐'.repeat(rating);
  };
  return (
    <Link href={`/listing/${id}`}>
      <Card className="group hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer h-full border-gray-200 hover:-translate-y-1 overflow-hidden">
        {image_url && (
          <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
            <img
              src={image_url}
              alt={title || 'Zdjęcie ogłoszenia'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant={source === 'otomoto' ? 'default' : 'secondary'}
                  className="font-semibold"
                >
                  {source}
                </Badge>
                {average_rating && review_count > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{average_rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({review_count})</span>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                {title || 'Brak tytułu'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <span>{location || 'Brak lokalizacji'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {current_price.toLocaleString('pl-PL')} zł
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
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
                "{userReview.comment}"
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(userReview.created_at), {
                  addSuffix: true,
                  locale: pl,
                })}
              </p>
            </div>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}
