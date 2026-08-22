'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReviewForm } from '@/components/review-form';
import { ReviewList } from '@/components/review-list';
import { PriceHistory } from '@/components/price-history';
import { ListingCard } from '@/components/listing-card';
import { ExternalLink, MapPin, Calendar, Heart, TrendingDown, TrendingUp, Share2, Store, Star } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { computePriceChangePercent } from '@/lib/price-change';
import {
  fetchListingPageData,
  type Listing,
  type ListingPageData,
  type SellerStats,
  type Snapshot,
} from '@/lib/listing-data';
import { computeListingScore } from '@/lib/listing-score';
import { ListingScoreCard } from '@/components/listing-score-card';
import { PriceComparisonCard } from '@/components/price-comparison-card';
import { PartnerCta } from '@/components/partner-cta';

export function ListingClient({
  listingId,
  initialData,
}: {
  listingId: string;
  initialData: ListingPageData | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [listing, setListing] = useState<Listing | null>(initialData?.listing ?? null);
  const [sellerStats, setSellerStats] = useState<SellerStats | null>(
    initialData?.sellerStats ?? null
  );
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialData?.snapshots ?? []);
  const [reviewRefresh, setReviewRefresh] = useState(0);
  const [hasUserReview, setHasUserReview] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [reviewCount, setReviewCount] = useState(initialData?.reviewCount ?? 0);
  const [averageRating, setAverageRating] = useState<number | null>(
    initialData?.averageRating ?? null
  );
  const [hasReportedReview, setHasReportedReview] = useState(
    initialData?.hasReportedReview ?? false
  );
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [recommendedListings, setRecommendedListings] = useState<Listing[]>(
    initialData?.recommendedListings ?? []
  );

  // Pierwszy render dostaje komplet danych z serwera, wiec odpytujemy baze
  // dopiero gdy uzytkownik doda opinie - inaczej skasowalibysmy tresc, ktora
  // jest juz w HTML-u, i strona mrugnelaby pustym stanem.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let cancelled = false;

    async function refreshListingData() {
      const data = await fetchListingPageData(supabase, listingId);
      if (cancelled || !data) return;

      setListing(data.listing);
      setSnapshots(data.snapshots);
      setReviewCount(data.reviewCount);
      setAverageRating(data.averageRating);
      setHasReportedReview(data.hasReportedReview);
      setSellerStats(data.sellerStats);
      setRecommendedListings(data.recommendedListings);
    }

    refreshListingData();

    return () => {
      cancelled = true;
    };
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

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareTitle = listing?.title || 'Ogłoszenie na obczajone.pl';

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
      } catch {
        // User cancelled the share sheet — nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link skopiowany',
        description: 'Link do ogłoszenia został skopiowany do schowka',
      });
    } catch {
      toast({
        title: 'Błąd',
        description: 'Nie udało się skopiować linku',
        variant: 'destructive',
      });
    }
  };

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
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
  const earliestSnapshot = snapshots.length > 1
    ? [...snapshots].sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime())[0]
    : null;
  const priceChangePercent = earliestSnapshot
    ? computePriceChangePercent(listing.current_price, earliestSnapshot.price)
    : null;

  const listingScore = computeListingScore({
    priceChangePercent,
    priceVsMedianPercent: initialData?.priceComparison?.percentVsMedian ?? null,
    averageRating,
    reviewCount,
    hasReportedReview,
    aiOpinionRating: listing.ai_opinion_rating,
    isActive: listing.is_active,
    daysSinceFirstSeen: differenceInDays(
      new Date(),
      new Date(listing.original_posted_at || listing.first_seen_at)
    ),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            {(() => {
              const hasHumanReviews = reviewCount > 0 && !!averageRating;
              const hasAiOnly = !hasHumanReviews && listing.ai_opinion_rating != null;
              const showSummary = hasHumanReviews || hasAiOnly;
              const displayRating = hasHumanReviews ? averageRating! : listing.ai_opinion_rating!;

              return (
                <Card
                  className={showSummary ? 'mb-4 cursor-pointer transition-colors hover:bg-muted/50' : 'mb-4'}
                  onClick={
                    showSummary
                      ? () => {
                          document.getElementById('opinie-uzytkownikow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      : undefined
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Opinie użytkowników</CardTitle>
                      {showSummary ? (
                        <div className="flex items-center gap-3">
                          {hasAiOnly && (
                            <Badge className="bg-blue-600 text-white hover:bg-blue-600">Opinia AI</Badge>
                          )}
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-5 w-5 ${
                                  i < Math.round(displayRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <div className="text-3xl font-bold text-gray-900">
                            {displayRating.toFixed(1)}
                          </div>
                          {hasHumanReviews && (
                            <div className="text-sm text-gray-500">
                              {reviewCount} {reviewCount === 1 ? 'opinia' : reviewCount < 5 ? 'opinie' : 'opinii'}
                            </div>
                          )}
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
              );
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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
                                ? 'ring-2 ring-primary opacity-100'
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
                  <h1 className="text-2xl font-semibold leading-none tracking-tight">
                    {listing.title || latestSnapshot?.title || 'Ładowanie...'}
                  </h1>
                  <CardDescription className="text-base space-y-2 mt-3">
                    {listing.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {listing.location}
                      </div>
                    )}
                    {listing.seller && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Store className="h-4 w-4" />
                          <Link
                            href={`/seller/${listing.seller.id}`}
                            className="text-primary hover:underline"
                          >
                            {listing.seller.name} ({listing.seller.city})
                          </Link>
                        </div>
                        {sellerStats && (
                          <div className="flex items-center gap-2 text-sm">
                            {sellerStats.averageRating != null && (
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3.5 w-3.5 ${
                                      i < Math.round(sellerStats.averageRating!)
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                                <span className="font-semibold">{sellerStats.averageRating.toFixed(1)}</span>
                                <span className="text-muted-foreground">
                                  ({sellerStats.reviewCount})
                                </span>
                              </div>
                            )}
                            <span className="text-muted-foreground">
                              {sellerStats.listingsCount} sprawdzonych aut
                            </span>
                          </div>
                        )}
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
                    <div className="mb-4">
                      <div className="text-4xl font-bold text-gray-900">
                        {listing.current_price.toLocaleString('pl-PL')} zł
                      </div>
                      {priceChangePercent != null && priceChangePercent !== 0 && (
                        <div
                          className={`inline-flex items-center gap-1 text-sm font-semibold mt-1 ${
                            priceChangePercent < 0 ? 'text-success' : 'text-warning'
                          }`}
                        >
                          {priceChangePercent < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          {priceChangePercent < 0 ? '' : '+'}
                          {priceChangePercent.toFixed(0)}% od pierwszego wykrycia
                        </div>
                      )}
                      {priceChangePercent === 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Cena bez zmian od pierwszego wykrycia
                        </div>
                      )}
                    </div>
                  )}
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full text-white font-medium py-3 px-4 rounded-lg transition-colors bg-primary hover:bg-primary/90"
                  >
                    Zobacz oryginalne ogłoszenie
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button onClick={handleShare} variant="outline" className="w-full">
                    <Share2 className="h-4 w-4 mr-2" />
                    Udostępnij
                  </Button>
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

          {initialData?.priceComparison && (
            <PriceComparisonCard comparison={initialData.priceComparison} />
          )}

          <ListingScoreCard score={listingScore} />

          <PartnerCta
            source={listing.source as 'otomoto' | 'otodom'}
            listingId={listingId}
            listingLocation={
              listing.seller?.lat != null && listing.seller?.lng != null
                ? { lat: listing.seller.lat, lng: listing.seller.lng }
                : null
            }
          />

          {latestSnapshot?.description && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Opis</CardTitle>
              </CardHeader>
              <CardContent>
                {/*
                  Rendered as plain text (not dangerouslySetInnerHTML). This
                  field is populated from scraped third-party listing data and
                  writable by any authenticated user via the listing_snapshots
                  table, so it must never be interpreted as HTML - doing so
                  previously allowed stored XSS against every visitor of this
                  page. whitespace-pre-line preserves line breaks without
                  needing raw HTML.
                */}
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {latestSnapshot.description}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Historia cen</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceHistory snapshots={snapshots} />
            </CardContent>
          </Card>

          {recommendedListings.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Podobne ogłoszenia z {listing.source}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendedListings.map((rec) => (
                    <ListingCard key={rec.id} {...rec} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div id="opinie-uzytkownikow">
            <ReviewForm
              listingId={listingId}
              onReviewAdded={() => setReviewRefresh(prev => prev + 1)}
              hasUserReview={hasUserReview}
            />

            <div className="mt-4">
              <ReviewList
                listingId={listingId}
                refreshTrigger={reviewRefresh}
                initialReviews={initialData?.reviews}
                onHasUserReview={(hasReview) => setHasUserReview(hasReview)}
                aiOpinion={
                  listing?.ai_opinion_rating != null
                    ? {
                        rating: listing.ai_opinion_rating,
                        summary: listing.ai_opinion_summary ?? '',
                        priceNote: listing.ai_opinion_price_note ?? '',
                        watchOutFor: listing.ai_opinion_watch_out ?? [],
                      }
                    : null
                }
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
