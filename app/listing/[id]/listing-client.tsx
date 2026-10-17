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
import { MapPin, Calendar, Heart, TrendingDown, TrendingUp, Share2, Store, Star, Bell, BellRing, Car, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
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
import { AiOpinionCard } from '@/components/ai-opinion-card';
import { ListingPrimaryActions } from '@/components/listing-primary-actions';
import { ListingSignals } from '@/components/listing-signals';
import { PriceWatchForm } from '@/components/price-watch-form';
import { ModelWatchForm } from '@/components/model-watch-form';
import { coordsFromLocation } from '@/lib/geo';
import { PriceVerdictCard } from '@/components/price-verdict-card';
import { assessNegotiation, assessPriceVerdict } from '@/lib/price-verdict';
import { slugifyModel } from '@/lib/model-slug';
import { largePhotoUrl } from '@/lib/photo-url';
import { PartnerCta } from '@/components/partner-cta';
import { VinCheckCta } from '@/components/vin-check-cta';
import { ListingInspections } from '@/components/partner/listing-inspections';
import { ListingNotCaptured } from '@/components/listing-not-captured';

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
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [reviewCount, setReviewCount] = useState(initialData?.reviewCount ?? 0);
  const [averageRating, setAverageRating] = useState<number | null>(
    initialData?.averageRating ?? null
  );
  const [hasReportedReview, setHasReportedReview] = useState(
    initialData?.hasReportedReview ?? false
  );
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  // Zdjęcia, których CDN Otomoto już nie oddaje. Archiwalne ogłoszenia
  // żyją u nas dłużej niż ich pliki, więc zepsuty obrazek ma zniknąć,
  // a nie zostać pustą ramką.
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(() => new Set());
  const markPhotoFailed = (url: string) =>
    setFailedPhotos((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));
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
      // `fetchListingPageData` rzuca teraz przy błędzie bazy, żeby render
      // serwerowy nie zapiekł 404 w cache'u. Tutaj to samo nie może wywrócić
      // strony: użytkownik ma już komplet treści z HTML-a, więc nieudane
      // odświeżenie po dodaniu opinii ma po prostu nic nie zmienić.
      const data = await fetchListingPageData(supabase, listingId).catch(() => null);
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

  // Oglądane ogłoszenia trafiają do kolejki z codzienną ceną (cron :27).
  // Zapis idzie z przeglądarki, bo strona jest w cache'u i render serwerowy
  // nie widzi pojedynczych wejść. Roboty pomijamy, inaczej crawler Google
  // wpisałby do kolejki całą sitemapę.
  const isActive = listing?.is_active ?? false;
  useEffect(() => {
    if (!isActive) return;
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent)) {
      return;
    }
    supabase.rpc('mark_listing_viewed', { p_listing_id: listingId }).then(() => {});
  }, [listingId, isActive]);

  /*
    Sprawdzenie przy wejściu. Gdy cena jest starsza niż doba, prosimy scrapera
    o sprawdzenie tego ogłoszenia od razu i po kilku sekundach podmieniamy dane
    na stronie. O tym, czy wolno (aktywne, raz na dobę, limit godzinowy),
    decyduje baza - tutaj tylko nie pytamy bez potrzeby.
  */
  const [liveCheck, setLiveCheck] = useState<'idle' | 'checking' | 'done'>('idle');
  const lastCheckedAt = listing?.last_checked_at ?? null;
  const liveCheckStarted = useRef(false);
  useEffect(() => {
    if (liveCheckStarted.current || !isActive || !lastCheckedAt) return;
    if (Date.now() - new Date(lastCheckedAt).getTime() < 24 * 60 * 60 * 1000) return;
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse/i.test(navigator.userAgent)) {
      return;
    }
    liveCheckStarted.current = true;
    setLiveCheck('checking');

    (async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/daily-price-scraper`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: 'visit', listingId }),
          }
        );
        const result = await response.json().catch(() => null);
        if (!result?.total) {
          setLiveCheck('idle');
          return;
        }
        const data = await fetchListingPageData(supabase, listingId).catch(() => null);
        if (data) {
          setListing(data.listing);
          setSnapshots(data.snapshots);
        }
        setLiveCheck('done');
      } catch {
        setLiveCheck('idle');
      }
    })();
  }, [listingId, isActive, lastCheckedAt]);

  useEffect(() => {
    async function checkFavorite() {
      if (!user || !listingId) return;

      const { data } = await supabase
        .from('favorites')
        .select('id, notify_on_price_drop')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .maybeSingle();

      setIsFavorite(!!data);
      setAlertEnabled(!!data?.notify_on_price_drop);
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

  /**
   * Włączenie alertu zakłada wpis w ulubionych, jeżeli go jeszcze nie ma -
   * użytkownik chce dostać maila, a nie wykonywać dwa kliknięcia. Zapamiętujemy
   * przy tym bieżącą cenę jako punkt odniesienia dla przyszłych spadków.
   */
  const togglePriceAlert = async () => {
    if (!user) {
      toast({
        title: 'Zaloguj się, żeby dostać powiadomienie',
        description: 'Wyślemy Ci maila, gdy sprzedający obniży cenę tego ogłoszenia.',
        variant: 'destructive',
      });
      return;
    }

    setAlertLoading(true);
    const next = !alertEnabled;

    try {
      const { error } = await supabase.from('favorites').upsert(
        {
          user_id: user.id,
          listing_id: listingId,
          notify_on_price_drop: next,
          last_notified_price: next ? listing?.current_price ?? null : null,
        },
        { onConflict: 'user_id,listing_id' }
      );

      if (error) throw error;

      setAlertEnabled(next);
      if (next) setIsFavorite(true);

      toast({
        title: next ? 'Powiadomienie włączone' : 'Powiadomienie wyłączone',
        description: next
          ? 'Napiszemy do Ciebie, gdy cena tego ogłoszenia spadnie.'
          : 'Nie będziemy już informować o zmianach ceny tego ogłoszenia.',
      });
    } catch (error) {
      console.error('Error toggling price alert:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się zmienić powiadomienia',
        variant: 'destructive',
      });
    } finally {
      setAlertLoading(false);
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

  // Ogłoszenie bez ani jednej ceny: wklejone, ale nigdy nie pobrane. Zamiast
  // pustej karty „0 zł” mówimy wprost, czego nie mamy i co możemy dać zamiast.
  if (!(listing.current_price > 0)) {
    return <ListingNotCaptured url={listing.url} isGone={!listing.is_active} />;
  }

  const latestSnapshot = snapshots[0];

  /*
    Galeria i opis z najnowszego snapshotu, który je MA, a nie z najnowszego
    w ogóle. Przeloty zapisują samą cenę, więc po pierwszej zmianie ceny
    galeria znikała. 14 października bez zdjęcia pokazywało się 11 176
    z 12 033 ogłoszeń Otomoto, choć 9 389 z nich miało zdjęcie główne
    w `listings.image_url`. Ono jest ostatnią deską ratunku.
  */
  const photoSnapshot = snapshots.find((s) => s.photo_urls?.length > 0);
  const photos: string[] = photoSnapshot
    ? photoSnapshot.photo_urls
    : listing.image_url
      ? [largePhotoUrl(listing.image_url)]
      : [];
  const description = snapshots.find((s) => s.description?.trim())?.description ?? null;
  const visiblePhotos = photos.filter((url) => !failedPhotos.has(url));
  const currentPhoto = visiblePhotos[Math.min(selectedPhoto, visiblePhotos.length - 1)];
  const earliestSnapshot = snapshots.length > 1
    ? [...snapshots].sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime())[0]
    : null;
  const priceChangePercent = earliestSnapshot
    ? computePriceChangePercent(listing.current_price, earliestSnapshot.price)
    : null;

  /*
    Położenie ogłoszenia: najpierw współrzędne sprzedawcy, a gdy ich nie ma -
    miasto z pola `location`. Przy 87% ogłoszeń sprzedawca nie ma współrzędnych,
    więc bez tego dobór partnera po odległości w ogóle nie działa i każdemu
    pokazujemy każdego, niezależnie od tego, gdzie stoi auto.
  */
  /*
    Trzy źródła pozycji, od najdokładniejszego. Współrzędne z ogłoszenia podaje
    Otodom i wskazują sam adres nieruchomości. Adres sprzedającego (Otomoto)
    jest miejscem, gdzie auto stoi, więc wystarcza. Słownik miast jest ostatni:
    zna 168 pozycji, więc wszystko spoza tej listy - jak Pogórze pod Gdynią -
    wypadało wcześniej z doboru firmy, mimo że miasto było znane.
  */
  const listingLocation =
    listing.lat != null && listing.lng != null
      ? { lat: listing.lat, lng: listing.lng }
      : listing.seller?.lat != null && listing.seller?.lng != null
        ? { lat: listing.seller.lat, lng: listing.seller.lng }
        : coordsFromLocation(listing.location);

  const aiOpinion =
    listing.ai_opinion_rating != null
      ? {
          rating: listing.ai_opinion_rating,
          summary: listing.ai_opinion_summary ?? '',
          priceNote: listing.ai_opinion_price_note ?? '',
          watchOutFor: listing.ai_opinion_watch_out ?? [],
        }
      : null;

  const modelTrend = initialData?.modelTrend ?? null;
  const priceVerdict = assessPriceVerdict(
    listing.current_price,
    initialData?.priceComparison ?? null
  );
  // Pierwsza cena z historii, tak samo jak przy wyliczaniu zmiany ceny wyżej.
  const negotiation = listing.is_active
    ? assessNegotiation(listing.current_price, earliestSnapshot?.price ?? null, modelTrend)
    : null;

  const listingScore = computeListingScore({
    priceChangePercent,
    priceVsMedianPercent: initialData?.priceComparison?.percentVsMedian ?? null,
    priceComparisonStrict: initialData?.priceComparison?.strict ?? false,
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
          <div>
            {(() => {
              const hasHumanReviews = reviewCount > 0 && !!averageRating;
              const hasAiOnly = !hasHumanReviews && listing.ai_opinion_rating != null;
              const showSummary = hasHumanReviews || hasAiOnly;
              const displayRating = hasHumanReviews ? averageRating! : listing.ai_opinion_rating!;

              // Bez żadnej oceny karta była samym przyciskiem „Zostaw swoją
              // opinię” nad zdjęciem auta, czyli pierwszą rzeczą na stronie.
              // Formularz opinii i tak jest niżej.
              if (!showSummary) return null;

              return (
                <Card
                  className="mb-6 cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => {
                    // Gdy podsumowanie pokazuje ocenę AI, a opinii ludzi jeszcze
                    // nie ma, kliknięcie musi prowadzić do samej opinii AI - sekcja
                    // opinii użytkowników mówiłaby wtedy "Brak opinii".
                    const target = hasAiOnly ? 'opinia-ai' : 'opinie-uzytkownikow';
                    document
                      .getElementById(target)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Opinie użytkowników</CardTitle>
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
                    </div>
                  </CardHeader>
                </Card>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Kolumna zdjęć jest zawsze. Bez niej strona ogłoszenia była samym
                tekstem na całą szerokość, a tak wygląda pierwsze wejście z Google
                na zdjęte ogłoszenie. */}
            <div className="lg:col-span-2">
              {currentPhoto ? (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div
                      className="relative bg-gray-100 cursor-pointer hover:opacity-95 transition-opacity flex items-center justify-center"
                      style={{ minHeight: '400px', maxHeight: '600px' }}
                      onClick={() => window.open(currentPhoto, '_blank')}
                    >
                      <img
                        src={currentPhoto}
                        alt={listing.title}
                        onError={() => markPhotoFailed(currentPhoto)}
                        className="max-w-full max-h-full object-contain"
                        style={{ maxHeight: '600px' }}
                      />
                    </div>
                    {visiblePhotos.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 p-4">
                        {visiblePhotos.map((url, idx) => (
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
                              onError={() => markPhotoFailed(url)}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden h-full">
                  <CardContent className="p-0 h-full">
                    <div
                      className="flex h-full flex-col items-center justify-center gap-3 bg-muted px-6 py-12 text-center"
                      style={{ minHeight: '400px' }}
                    >
                      <Car className="h-16 w-16 text-muted-foreground/40" />
                      <p className="text-lg font-semibold text-foreground">
                        {listing.specs?.brand && listing.specs?.model
                          ? `${listing.specs.brand} ${listing.specs.model}`
                          : listing.title}
                      </p>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        {listing.is_active
                          ? 'Nie mamy zapisanego zdjęcia tej oferty. Zobaczysz je w oryginalnym ogłoszeniu.'
                          : 'Ogłoszenie zniknęło z serwisu razem ze zdjęciami. Zostały cena i jej historia.'}
                      </p>
                      {listing.is_active && (
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          Zobacz zdjęcia w ogłoszeniu
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
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
                  {/* Sygnały idą tu, nad opisem i lokalizacją: kto zna to
                      ogłoszenie z autopsji, ma je pod ręką bez scrollowania,
                      a kto dopiero czyta - od razu widzi, czy ktoś już był. */}
                  <div className="mt-4">
                    <ListingSignals listingId={listingId} />
                  </div>
                  {/* div, nie CardDescription: ten blok zawiera elementy blokowe, a
                      CardDescription renderuje <p>. <div> w <p> przeglądarka
                      przenosi na zewnątrz, przez co HTML z serwera nie zgadza się
                      z tym, co React buduje po stronie klienta - i cała strona
                      jest renderowana od nowa w przeglądarce. */}
                  <div className="text-sm text-muted-foreground text-base space-y-2 mt-3">
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
                  </div>
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
                      {liveCheck === 'checking' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Sprawdzamy aktualną cenę na {listing.source === 'otodom' ? 'Otodom' : 'Otomoto'}…
                        </div>
                      )}
                      {liveCheck === 'done' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          {listing.is_active
                            ? 'Cena sprawdzona przed chwilą'
                            : 'Właśnie sprawdziliśmy: tej oferty już nie ma w serwisie'}
                        </div>
                      )}
                    </div>
                  )}
                  <ListingPrimaryActions
                    source={listing.source as 'otomoto' | 'otodom'}
                    listingId={listingId}
                    listingUrl={listing.url}
                    listingLocation={listingLocation}
                    watchOutCount={aiOpinion?.watchOutFor.length ?? 0}
                  />
                  {/* Zalogowany ma alert przy swoich ulubionych, więc zostaje
                      przy przycisku. Reszta - czyli praktycznie wszyscy, bo kont
                      jest dziesięć - dostaje to samo za jeden adres e-mail,
                      zamiast pięciu kroków rejestracji. */}
                  {/* Zdjęte ogłoszenie już nie stanieje. Kto trafił tu z Google
                      na archiwum, szuka zwykle takiego samego auta, więc
                      proponujemy alert na model zamiast alertu na cenę. */}
                  {!listing.is_active ? (
                    modelTrend && (
                      <ModelWatchForm
                        brand={modelTrend.brand}
                        model={modelTrend.model}
                        medianPrice={modelTrend.medianPrice}
                        stacked
                      />
                    )
                  ) : (
                    <div id="powiadomienie-o-cenie">
                      {user ? (
                        <Button
                          onClick={togglePriceAlert}
                          disabled={alertLoading}
                          variant={alertEnabled ? 'default' : 'outline'}
                          className="w-full"
                        >
                          {alertEnabled ? (
                            <BellRing className="h-4 w-4 mr-2 fill-current" />
                          ) : (
                            <Bell className="h-4 w-4 mr-2" />
                          )}
                          {alertEnabled ? 'Powiadomimy o spadku ceny' : 'Powiadom mnie o spadku ceny'}
                        </Button>
                      ) : (
                        <PriceWatchForm listingId={listingId} />
                      )}
                    </div>
                  )}
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

          {/* Historia ceny pierwsza pod ogłoszeniem. To jedyna rzecz, której
              nie ma na Otomoto, i powód, żeby tu wrócić: od 13 października
              oglądane ogłoszenia dostają nową cenę codziennie. Do 14 października
              stała pod opinią AI, trzema zaproszeniami i opisem. */}
          <div className="mb-6">
            <PriceHistory
              snapshots={snapshots}
              lastCheckedAt={listing.last_checked_at}
              watchTargetId={listing.is_active ? 'powiadomienie-o-cenie' : undefined}
            />
          </div>

          {/* Ocena ceny zaraz za historią: odpowiada na pytanie, z którym tu
              się przychodzi ("czy to drogo i ile mogę zaproponować"). */}
          <PriceVerdictCard
            comparison={initialData?.priceComparison ?? null}
            verdict={priceVerdict}
            negotiation={negotiation}
            trend={modelTrend}
            trendSlug={modelTrend ? slugifyModel(modelTrend.brand, modelTrend.model) : null}
          />

          <VinCheckCta
            context="listing"
            listingId={listingId}
            source={listing.source as 'otomoto' | 'otodom'}
          />

          {/* Podobne oferty tuż za oceną ceny i VIN-em: kto zobaczył, że to
              auto jest drogie, od razu szuka innych. */}
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
          )}          {/* Oględziny i opinia AI za liczbami: mówią o tym konkretnym aucie,
              ale to cena przyciąga tu ludzi z Google.

              Kolejność w tym bloku jest celowa: jeżeli ktoś obejrzał to auto na
              żywo, jego zdanie idzie przed opinią modelu. Specjalista stał przy
              samochodzie, model przeczytał opis. Gdy oględzin nie ma, karta
              zwraca null i opinia AI zostaje pierwsza, tak jak dotąd. */}
          <ListingInspections inspections={initialData?.inspections ?? []} />

          {aiOpinion && <AiOpinionCard opinion={aiOpinion} />}

          <PartnerCta
            source={listing.source as 'otomoto' | 'otodom'}
            listingId={listingId}
            listingLocation={listingLocation}
            watchOutFor={aiOpinion?.watchOutFor ?? []}
          />

          <ListingScoreCard score={listingScore} />

          {description && (
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
                  {description}
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
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
