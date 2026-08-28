'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AiOpinionCard, type AiOpinion } from '@/components/ai-opinion-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Star, Flag, Pencil } from 'lucide-react';
import { ReviewEditDialog } from './review-edit-dialog';
import {
  attachReviewDetails,
  type ReviewProfile,
  type ReviewWithDetails,
} from '@/lib/listing-data';

type Profile = ReviewProfile;
type Review = ReviewWithDetails;

function ReviewAuthor({ profile }: { profile?: Profile | null }) {
  if (!profile) return null;

  if (profile.is_partner) {
    return (
      <div className="flex items-center gap-2 mb-2">
        {profile.partner_logo_url && (
          <img
            src={profile.partner_logo_url}
            alt={profile.display_name}
            className="h-6 w-6 rounded-full object-cover"
          />
        )}
        <span className="text-sm font-semibold text-gray-700">{profile.display_name}</span>
      </div>
    );
  }

  return (
    <span className="text-sm text-gray-500 mb-2 block">{profile.display_name}</span>
  );
}

type ReviewListProps = {
  listingId: string;
  refreshTrigger?: number;
  onHasUserReview?: (hasReview: boolean, review: Review | null) => void;
  aiOpinion?: AiOpinion | null;
  /** Zatwierdzone opinie pobrane serwerowo - trafiaja do HTML-a przed hydracja. */
  initialReviews?: Review[];
};

export function ReviewList({
  listingId,
  refreshTrigger,
  onHasUserReview,
  aiOpinion,
  initialReviews,
}: ReviewListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>(initialReviews ?? []);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  // Majac opinie z serwera nie pokazujemy "Ladowanie opinii..." - tresc jest
  // juz wyrenderowana, a doczytujemy tylko oczekujace opinie zalogowanego.
  const [loading, setLoading] = useState(initialReviews === undefined);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    const profilesById = new Map<string, Profile>();
    async function loadProfiles(userIds: string[]) {
      const missingIds = Array.from(new Set(userIds)).filter((id) => !profilesById.has(id));
      if (missingIds.length === 0) return;

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, is_partner, partner_logo_url')
        .in('id', missingIds);

      (profilesData || []).forEach((p) => {
        profilesById.set(p.id, {
          display_name: p.display_name,
          is_partner: p.is_partner,
          partner_logo_url: p.partner_logo_url,
        });
      });
    }

    if (!error && data) {
      setReviews(await attachReviewDetails(supabase, data));
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
        await loadProfiles(userPendingReviews.map((r) => r.user_id));

        const pendingWithPhotos = await Promise.all(
          userPendingReviews.map(async (review) => {
            const { data: photos } = await supabase
              .from('user_listing_photos')
              .select('id, photo_url, file_size, order_index')
              .eq('review_id', review.id)
              .order('order_index');

            return { ...review, photos: photos || [], profile: profilesById.get(review.user_id) ?? null };
          })
        );
        setPendingReviews(pendingWithPhotos);
        if (onHasUserReview) {
          onHasUserReview(pendingWithPhotos.length > 0, pendingWithPhotos[0] || null);
        }
      }
    }

    setLoading(false);
  }, [listingId, user, onHasUserReview]);

  useEffect(() => {
    setLoading(true);
    fetchReviews();
  }, [refreshTrigger, fetchReviews]);

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

  if (reviews.length === 0 && pendingReviews.length === 0 && !aiOpinion) {
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
      {aiOpinion && <AiOpinionCard opinion={aiOpinion} />}

      {pendingReviews.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Twoja opinia (czeka na moderację)</h3>
          {pendingReviews.map((review) => (
            <Card key={review.id} className="border-amber-200 bg-amber-50">
              <CardHeader>
                <ReviewAuthor profile={review.profile} />
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
                {review.photos && review.photos.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Zdjęcia ({review.photos.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {review.photos.map((photo) => (
                        <button
                          key={photo.id}
                          onClick={() => window.open(photo.photo_url, '_blank')}
                          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity cursor-pointer border border-gray-200"
                          aria-label="Otwórz zdjęcie w pełnym rozmiarze"
                        >
                          <img
                            src={photo.photo_url}
                            alt="Zdjęcie z opinii"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
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
            <ReviewAuthor profile={review.profile} />
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
            {review.photos && review.photos.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Zdjęcia ({review.photos.length})</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {review.photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => window.open(photo.photo_url, '_blank')}
                      className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity cursor-pointer border border-gray-200"
                      aria-label="Otwórz zdjęcie w pełnym rozmiarze"
                    >
                      <img
                        src={photo.photo_url}
                        alt="Zdjęcie z opinii"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t flex gap-2">
              {user && user.id === review.user_id && (
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
}
