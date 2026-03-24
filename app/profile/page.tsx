'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, MessageSquare, TrendingDown, TrendingUp, Minus, Loader as Loader2, Chrome as Home } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Listing = {
  id: string;
  url: string;
  title: string | null;
  source: string;
  created_at: string;
  latest_price: number | null;
  price_change: number | null;
  has_reviews: boolean;
  review_count: number;
};

type Review = {
  id: string;
  listing_id: string;
  comment: string;
  rating: number;
  created_at: string;
  updated_at: string;
  listing: {
    title: string | null;
    url: string;
    source: string;
  };
};

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Fetching data for user:', user.id);

      // Fetch user's listings with review count and latest price info
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select(`
          id,
          url,
          title,
          source,
          created_at,
          listing_snapshots (
            price,
            scraped_at
          ),
          reviews (
            id
          )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (listingsError) throw listingsError;

      // Process listings to get latest price and price change
      const processedListings: Listing[] = (listingsData || []).map((listing: any) => {
        const snapshots = listing.listing_snapshots || [];
        const sortedSnapshots = snapshots.sort((a: any, b: any) =>
          new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
        );

        const latestPrice = sortedSnapshots[0]?.price || null;
        const previousPrice = sortedSnapshots[1]?.price || null;
        const priceChange = latestPrice && previousPrice ? latestPrice - previousPrice : null;

        return {
          id: listing.id,
          url: listing.url,
          title: listing.title,
          source: listing.source,
          created_at: listing.created_at,
          latest_price: latestPrice,
          price_change: priceChange,
          has_reviews: listing.reviews.length > 0,
          review_count: listing.reviews.length,
        };
      });

      setListings(processedListings);

      // Fetch user's reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          id,
          listing_id,
          comment,
          rating,
          created_at,
          updated_at,
          listings (
            title,
            url,
            source
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
        throw reviewsError;
      }

      console.log('Reviews data from Supabase:', reviewsData);

      const processedReviews: Review[] = (reviewsData || [])
        .filter((review: any) => review.listings)
        .map((review: any) => ({
          id: review.id,
          listing_id: review.listing_id,
          comment: review.comment,
          rating: review.rating,
          created_at: review.created_at,
          updated_at: review.updated_at,
          listing: {
            title: review.listings.title,
            url: review.listings.url,
            source: review.listings.source,
          },
        }));

      setReviews(processedReviews);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriceChangeIcon = (change: number | null) => {
    if (!change) return <Minus className="h-4 w-4" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    return <TrendingDown className="h-4 w-4 text-green-500" />;
  };

  const getPriceChangeColor = (change: number | null) => {
    if (!change) return 'text-muted-foreground';
    if (change > 0) return 'text-red-500';
    return 'text-green-500';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStarRating = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mój Profil</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <Link href="/">
          <Button variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Strona główna
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="listings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="listings">
            Moje Ogłoszenia ({listings.length})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Moje Komentarze ({reviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-4">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nie dodałeś jeszcze żadnych ogłoszeń do śledzenia.
              </CardContent>
            </Card>
          ) : (
            listings.map((listing) => (
              <Card key={listing.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-2 truncate">
                        {listing.title || 'Bez tytułu'}
                      </CardTitle>
                      <CardDescription>
                        Dodano: {formatDate(listing.created_at)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{listing.source}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-6">
                    {listing.latest_price && (
                      <div>
                        <p className="text-sm text-muted-foreground">Aktualna cena</p>
                        <p className="text-2xl font-bold">
                          {listing.latest_price.toLocaleString('pl-PL')} zł
                        </p>
                      </div>
                    )}
                    {listing.price_change !== null && listing.price_change !== 0 && (
                      <div className="flex items-center gap-2">
                        {getPriceChangeIcon(listing.price_change)}
                        <span className={`font-medium ${getPriceChangeColor(listing.price_change)}`}>
                          {listing.price_change > 0 ? '+' : ''}
                          {listing.price_change.toLocaleString('pl-PL')} zł
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <Link href={`/listing/${listing.id}`}>
                      <Button variant="default">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Zobacz szczegóły
                        {listing.review_count > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {listing.review_count}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                    <a href={listing.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Otwórz ogłoszenie
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nie dodałeś jeszcze żadnych komentarzy.
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-2 truncate">
                        {review.listing.title || 'Bez tytułu'}
                      </CardTitle>
                      <CardDescription>
                        {formatDate(review.created_at)}
                        {review.updated_at !== review.created_at && ' (edytowano)'}
                      </CardDescription>
                    </div>
                    <div className="text-2xl">{getStarRating(review.rating)}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm whitespace-pre-wrap">{review.comment}</p>
                  <div className="flex items-center gap-4">
                    <Link href={`/listing/${review.listing_id}`}>
                      <Button variant="default">
                        Zobacz ogłoszenie
                      </Button>
                    </Link>
                    <a href={review.listing.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Otwórz źródło
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
