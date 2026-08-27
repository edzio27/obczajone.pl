'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { BadgeCheck, MessageSquare, Star } from 'lucide-react';
import type { PartnerReview } from '@/lib/partner-data';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`Ocena ${rating} z 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
        />
      ))}
    </span>
  );
}

type PartnerReviewListProps = {
  reviews: PartnerReview[];
  partnerName: string;
};

export function PartnerReviewList({ reviews, partnerName }: PartnerReviewListProps) {
  if (reviews.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">
            Nikt jeszcze nie ocenił tej firmy. Jeśli korzystałeś z jej usług, Twoja opinia będzie
            pierwsza.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {review.author?.display_name ?? 'Użytkownik'}
                  </span>
                  {review.is_verified_customer && (
                    <Badge
                      variant="outline"
                      className="gap-1 text-success border-success/30 text-xs"
                      title="Ten użytkownik wysłał do tej firmy zapytanie przez obczajone.pl"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      Kontakt przez obczajone.pl
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true, locale: pl })}
                  {review.service_type ? ` · ${review.service_type}` : ''}
                </span>
              </div>
              <Stars rating={review.rating} />
            </div>

            {review.comment && (
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {review.comment}
              </p>
            )}

            {review.reply && (
              <div className="mt-4 border-l-2 border-primary/30 bg-primary/5 rounded-r-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    Odpowiedź: {partnerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(review.reply.created_at), {
                      addSuffix: true,
                      locale: pl,
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {review.reply.body}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
