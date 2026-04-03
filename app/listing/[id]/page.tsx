'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Head from 'next/head';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReviewForm } from '@/components/review-form';
import { ReviewList } from '@/components/review-list';
import { PriceHistory } from '@/components/price-history';
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
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [recommendedListings, setRecommendedListings] = useState<Listing[]>([]);

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

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating')
        .eq('listing_id', listingId);

      if (reviewsData && reviewsData.length > 0) {
        setReviewCount(reviewsData.length);
        const avg = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
        setAverageRating(avg);
      }

      const { data: recommendedData } = await supabase
        .from('listings')
        .select('*')
        .eq('source', listingData.source)
        .neq('id', listingId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recommendedData) {
        setRecommendedListings(recommendedData);
      }

      setListing(listingData);
      setLoading(false);
    }

    fetchData();
  }, [listingId, reviewRefresh]);

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

  const pageTitle = `${listing.title} - ${listing.location} | obczajone.pl`;
  const pageDescription = `Sprawdź historię cen i opinie dla: ${listing.title}. Aktualna cena: ${listing.current_price.toLocaleString('pl-PL')} zł. ${reviewCount} opinii użytkowników.`;
  const imageUrl = latestSnapshot?.photo_urls?.[0] || 'https://obczajone.pl/og-image.png';

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={`https://obczajone.pl/listing/${listingId}`} />
        <meta property="og:type" content="product" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={imageUrl} />
        <link rel="canonical" href={`https://obczajone.pl/listing/${listingId}`} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: listing.title,
              description: pageDescription,
              image: imageUrl,
              offers: {
                '@type': 'Offer',
                price: listing.current_price,
                priceCurrency: 'PLN',
                availability: listing.is_active ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                url: listing.url,
              },
              aggregateRating: reviewCount > 0 && averageRating ? {
                '@type': 'AggregateRating',
                ratingValue: averageRating.toFixed(1),
                reviewCount: reviewCount,
                bestRating: 5,
                worstRating: 1,
              } : undefined,
            }),
          }}
        />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Ocena i opinie - SAMA GÓRA */}
          <div className="mb-6">
            <Card className="mb-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Opinie użytkowników</CardTitle>
                  {reviewCount > 0 && averageRating ? (
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-bold text-gray-900">
                        {averageRating.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {reviewCount} {reviewCount === 1 ? 'opinia' : reviewCount < 5 ? 'opinie' : 'opinii'}
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => {
                      const reviewForm = document.querySelector('[data-review-form]');
                      if (reviewForm) {
                        reviewForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}>
                      Zostaw swoją opinię
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Zdjęcia - Galeria główna */}
            {latestSnapshot?.photo_urls && latestSnapshot.photo_urls.length > 0 && (
              <div className="lg:col-span-2">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div
                      className="relative bg-gray-100 cursor-pointer hover:opacity-95 transition-opacity flex items-center justify-center"
                      style={{ minHeight: '400px', maxHeight: '600px' }}
                      onClick={() => window.open(latestSnapshot.photo_urls[selectedPhoto], '_blank')}
                    >
                      <img
                        src={latestSnapshot.photo_urls[selectedPhoto]}
                        alt={listing.title}
                        className="max-w-full max-h-full object-contain"
                        style={{ maxHeight: '600px' }}
                      />
                    </div>
                    {latestSnapshot.photo_urls.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 p-4">
                        {latestSnapshot.photo_urls.map((url, idx) => (
                          <div
                            key={idx}
                            className={`relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer transition-all flex items-center justify-center ${
                              selectedPhoto === idx
                                ? 'ring-2 ring-blue-500 opacity-100'
                                : 'hover:opacity-80 opacity-60'
                            }`}
                            style={{ aspectRatio: '1', minHeight: '80px' }}
                            onClick={() => setSelectedPhoto(idx)}
                          >
                            <img
                              src={url}
                              alt={`Zdjęcie ${idx + 1}`}
                              className="w-full h-full object-contain"
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
                    className="inline-flex items-center justify-center gap-2 w-full text-white font-medium py-3 px-4 rounded-lg transition-colors hover:opacity-90"
                    style={{ background: '#F97316' }}
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

          {/* Historia cen */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Historia cen</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceHistory snapshots={snapshots} />
            </CardContent>
          </Card>

          {/* Polecane ogłoszenia */}
          {recommendedListings.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Podobne ogłoszenia z {listing.source}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recommendedListings.map((rec) => (
                    <a
                      key={rec.id}
                      href={`/listing/${rec.id}`}
                      className="block border rounded-lg p-4 hover:border-blue-500 transition-colors"
                    >
                      <h3 className="font-medium mb-2 line-clamp-2">{rec.title}</h3>
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <MapPin className="h-3 w-3 mr-1" />
                        {rec.location}
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {rec.current_price.toLocaleString('pl-PL')} zł
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <ReviewForm
              listingId={listingId}
              onReviewAdded={() => setReviewRefresh(prev => prev + 1)}
              hasUserReview={hasUserReview}
            />

            <div className="mt-4">
              <ReviewList
                listingId={listingId}
                refreshTrigger={reviewRefresh}
                onHasUserReview={(hasReview) => setHasUserReview(hasReview)}
              />
            </div>
          </div>
        </div>
      </main>
      </div>
    </>
  );
}
