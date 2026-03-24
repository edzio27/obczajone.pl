'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Star, Flag, Pencil } from 'lucide-react';
import { ReviewEditDialog } from './review-edit-dialog';

type Review = {
  id: string;
  user_id: string;
  visited_in_person: boolean;
  rating: number;
  price_difference: string;
  condition_difference: string;
  size_mileage_difference: string;
  equipment_difference: string;
  photos_difference: string;
  comment: string;
  created_at: string;
};

type ReviewListProps = {
  listingId: string;
  refreshTrigger?: number;
  onHasUserReview?: (hasReview: boolean, review: Review | null) => void;
};

export function ReviewList({ listingId, refreshTrigger, onHasUserReview }: ReviewListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchReviews() {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', listingId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReviews(data);
      }

      if (user) {
        const { data: userPendingReviews, error: pendingError } = await supabase
          .from('reviews')
          .select('*')
          .eq('listing_id', listingId)
          .eq('user_id', user.id)
          .eq('is_approved', false)
          .order('created_at', { ascending: false });

        if (!pendingError && userPendingReviews) {
          setPendingReviews(userPendingReviews);
          if (onHasUserReview) {
            onHasUserReview(userPendingReviews.length > 0, userPendingReviews[0] || null);
          }
        }
      }

      setLoading(false);
    }

    fetchReviews();
  }, [listingId, refreshTrigger, user]);

  const handleReport = async (reviewId: string) => {
    if (!user) {
      toast({
        title: 'Zaloguj się',
        description: 'Musisz być zalogowany, aby zgłosić opinię',
        variant: 'destructive',
      });
      return;
    }

    const reason = prompt('Powód zgłoszenia:');
    if (!reason) return;

    try {
      await supabase.from('reports').insert({
        review_id: reviewId,
        reported_by: user.id,
        reason,
      });

      toast({
        title: 'Zgłoszenie wysłane',
        description: 'Dziękujemy za zgłoszenie. Sprawdzimy tę opinię.',
      });
    } catch (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się wysłać zgłoszenia',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Ładowanie opinii...</p>
        </CardContent>
      </Card>
    );
  }

  if (reviews.length === 0 && pendingReviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brak opinii</CardTitle>
          <CardDescription>
            Bądź pierwszą osobą, która doda opinię o tym ogłoszeniu
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pendingReviews.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Twoja opinia (czeka na moderację)</h3>
          {pendingReviews.map((review) => (
            <Card key={review.id} className="border-amber-200 bg-amber-50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {review.visited_in_person && (
                      <Badge variant="secondary">Był/a na miejscu</Badge>
                    )}
                    <Badge variant="outline" className="bg-amber-100">Oczekuje na moderację</Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(review.created_at), {
                      addSuffix: true,
                      locale: pl,
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.price_difference && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Cena</h4>
                    <p className="text-gray-600">{review.price_difference}</p>
                  </div>
                )}
                {review.condition_difference && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Stan</h4>
                    <p className="text-gray-600">{review.condition_difference}</p>
                  </div>
                )}
                {review.size_mileage_difference && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Wielkość / Przebieg</h4>
                    <p className="text-gray-600">{review.size_mileage_difference}</p>
                  </div>
                )}
                {review.equipment_difference && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Wyposażenie</h4>
                    <p className="text-gray-600">{review.equipment_difference}</p>
                  </div>
                )}
                {review.photos_difference && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Zdjęcia</h4>
                    <p className="text-gray-600">{review.photos_difference}</p>
                  </div>
                )}
                {review.comment && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-1">Komentarz</h4>
                    <p className="text-gray-600">{review.comment}</p>
                  </div>
                )}
                <div className="pt-2 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingReview(review);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edytuj
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reviews.length > 0 && (
        <>
          <h3 className="text-xl font-semibold">Zatwierdzone opinie ({reviews.length})</h3>
          {reviews.map((review) => (
        <Card key={review.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                {review.visited_in_person && (
                  <Badge variant="secondary">Był/a na miejscu</Badge>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(review.created_at), {
                  addSuffix: true,
                  locale: pl,
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {review.price_difference && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Cena</h4>
                <p className="text-gray-600">{review.price_difference}</p>
              </div>
            )}
            {review.condition_difference && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Stan</h4>
                <p className="text-gray-600">{review.condition_difference}</p>
              </div>
            )}
            {review.size_mileage_difference && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Wielkość / Przebieg</h4>
                <p className="text-gray-600">{review.size_mileage_difference}</p>
              </div>
            )}
            {review.equipment_difference && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Wyposażenie</h4>
                <p className="text-gray-600">{review.equipment_difference}</p>
              </div>
            )}
            {review.photos_difference && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Zdjęcia</h4>
                <p className="text-gray-600">{review.photos_difference}</p>
              </div>
            )}
            {review.comment && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Komentarz</h4>
                <p className="text-gray-600">{review.comment}</p>
              </div>
            )}

            <div className="pt-2 border-t flex gap-2">
              {user && user.id === review.user_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: 'Funkcja w przygotowaniu',
                      description: 'Edycja opinii będzie dostępna wkrótce',
                    });
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edytuj
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReport(review.id)}
                className="text-gray-500"
              >
                <Flag className="h-4 w-4 mr-1" />
                Zgłoś
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
        </>
      )}

      {editingReview && (
        <ReviewEditDialog
          review={editingReview}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onReviewUpdated={() => {
            fetchReviews();
            setEditingReview(null);
          }}
        />
      )}
    </div>
  );

  async function fetchReviews() {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data);
    }

    if (user) {
      const { data: userPendingReviews, error: pendingError } = await supabase
        .from('reviews')
        .select('*')
        .eq('listing_id', listingId)
        .eq('user_id', user.id)
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (!pendingError && userPendingReviews) {
        setPendingReviews(userPendingReviews);
        if (onHasUserReview) {
          onHasUserReview(userPendingReviews.length > 0, userPendingReviews[0] || null);
        }
      }
    }

    setLoading(false);
  }
}
