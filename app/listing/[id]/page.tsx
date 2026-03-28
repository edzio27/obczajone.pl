'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewForm } from '@/components/review-form';
import { ReviewList } from '@/components/review-list';
import { PriceHistory } from '@/components/price-history';
import { PhotoUpload } from '@/components/photo-upload';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, MapPin, Calendar, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

type Listing = {
  id: string;
  listing_id: string;
  source: string;
  url: string;
  title: string;
  location: string;
  current_price: number;
  is_active: boolean;
  first_seen_at: string;
  last_checked_at: string;
};

type Snapshot = {
  id: string;
  price: number;
  title: string;
  description: string;
  photo_urls: string[];
  metadata: any;
  scraped_at: string;
};

export default function ListingPage() {
  const params = useParams();
  const listingId = params.id as string;
  const { user } = useAuth();
  const { toast } = useToast();

  const [listing, setListing] = useState<Listing | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewRefresh, setReviewRefresh] = useState(0);
  const [hasUserReview, setHasUserReview] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

      if (listingError) {
        console.error('Error fetching listing:', listingError);
        setLoading(false);
        return;
      }

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('listing_snapshots')
        .select('*')
        .eq('listing_id', listingId)
        .order('scraped_at', { ascending: false });

      if (!snapshotsError) {
        setSnapshots(snapshotsData || []);
      }

      setListing(listingData);
      setLoading(false);
    }

    fetchData();
  }, [listingId]);

  useEffect(() => {
    async function checkFavorite() {
      if (!user || !listingId) return;

      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .maybeSingle();

      setIsFavorite(!!data);
    }

    checkFavorite();
  }, [user, listingId]);

  const toggleFavorite = async () => {
    if (!user) {
      toast({
        title: 'Musisz być zalogowany',
        description: 'Zaloguj się, aby dodać ogłoszenie do polubionych',
        variant: 'destructive',
      });
      return;
    }

    setFavoriteLoading(true);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId);

        if (error) throw error;

        setIsFavorite(false);
        toast({
          title: 'Usunięto z polubionych',
          description: 'Ogłoszenie zostało usunięte z Twoich polubionych',
        });
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            listing_id: listingId,
          });

        if (error) throw error;

        setIsFavorite(true);
        toast({
          title: 'Dodano do polubionych',
          description: 'Ogłoszenie zostało dodane do Twoich polubionych',
        });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zaktualizować polubionych',
        variant: 'destructive',
      });
    } finally {
      setFavoriteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Nie znaleziono ogłoszenia</CardTitle>
              <CardDescription>
                Ogłoszenie o podanym ID nie istnieje w bazie danych
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  const latestSnapshot = snapshots[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Zdjęcia - Galeria główna */}
            {latestSnapshot?.photo_urls && latestSnapshot.photo_urls.length > 0 && (
              <div className="lg:col-span-2">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-gray-100">
                      <img
                        src={latestSnapshot.photo_urls[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {latestSnapshot.photo_urls.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 p-4">
                        {latestSnapshot.photo_urls.slice(1, 5).map((url, idx) => (
                          <div key={idx} className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={url}
                              alt={`Zdjęcie ${idx + 2}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Informacje podstawowe */}
            <div className={latestSnapshot?.photo_urls && latestSnapshot.photo_urls.length > 0 ? '' : 'lg:col-span-3'}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={listing.source === 'otomoto' ? 'default' : 'secondary'}>
                      {listing.source}
                    </Badge>
                    {!listing.is_active && (
                      <Badge variant="outline">Nieaktywne</Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl">
                    {listing.title || latestSnapshot?.title || 'Ładowanie...'}
                  </CardTitle>
                  <CardDescription className="text-base space-y-2 mt-3">
                    {listing.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {listing.location}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Dodano{' '}
                      {formatDistanceToNow(new Date(listing.first_seen_at), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {listing.current_price > 0 && (
                    <div className="text-4xl font-bold text-gray-900 mb-4">
                      {listing.current_price.toLocaleString('pl-PL')} zł
                    </div>
                  )}
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    Zobacz oryginalne ogłoszenie
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {user && (
                    <Button
                      onClick={toggleFavorite}
                      disabled={favoriteLoading}
                      variant={isFavorite ? 'default' : 'outline'}
                      className="w-full"
                    >
                      <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                      {isFavorite ? 'Usuń z polubionych' : 'Dodaj do polubionych'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Opis ogłoszenia */}
          {latestSnapshot?.description && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Opis</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: latestSnapshot.description }}
                />
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="reviews" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="reviews">Opinie</TabsTrigger>
              <TabsTrigger value="photos">Zdjęcia</TabsTrigger>
              <TabsTrigger value="history">Historia cen</TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="space-y-6">
              <ReviewForm
                listingId={listingId}
                onReviewAdded={() => setReviewRefresh(prev => prev + 1)}
                hasUserReview={hasUserReview}
              />
              <ReviewList
                listingId={listingId}
                refreshTrigger={reviewRefresh}
                onHasUserReview={(hasReview) => setHasUserReview(hasReview)}
              />
            </TabsContent>

            <TabsContent value="photos">
              <PhotoUpload listingId={listingId} />
            </TabsContent>

            <TabsContent value="history">
              <PriceHistory snapshots={snapshots} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
