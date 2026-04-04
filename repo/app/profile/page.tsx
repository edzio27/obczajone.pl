'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListingCard } from '@/components/listing-card';
import { MessageSquare, TrendingDown, TrendingUp, Minus, Loader as Loader2, Chrome as Home } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Listing = {
  id: string;
  url: string;
  title: string | null;
  location: string;
  source: string;
  created_at: string;
  current_price: number;
  latest_price: number | null;
  price_change: number | null;
  has_reviews: boolean;
  review_count: number;
  image_url: string | null;
  average_rating?: number;
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
    image_url: string | null;
    location: string;
    current_price: number;
    created_at: string;
    average_rating?: number;
    review_count?: number;
  };
};

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [favorites, setFavorites] = useState<Listing[]>([]);
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
          location,
          source,
          created_at,
          current_price,
          image_url,
          listing_snapshots (
            price,
            scraped_at
          ),
          reviews (
            id,
            rating
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

        const reviews = listing.reviews || [];
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
          : undefined;

        return {
          id: listing.id,
          url: listing.url,
          title: listing.title,
          location: listing.location || '',
          source: listing.source,
          created_at: listing.created_at,
          current_price: listing.current_price || latestPrice || 0,
          latest_price: latestPrice,
          price_change: priceChange,
          has_reviews: reviews.length > 0,
          review_count: reviews.length,
          image_url: listing.image_url,
          average_rating: avgRating,
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
            source,
            image_url,
            location,
            current_price,
            created_at,
            reviews (rating)
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
        .map((review: any) => {
          const reviews = review.listings.reviews || [];
          const avgRating = reviews.length > 0
            ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
            : undefined;

          return {
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
              image_url: review.listings.image_url,
              location: review.listings.location || '',
              current_price: review.listings.current_price || 0,
              created_at: review.listings.created_at,
              average_rating: avgRating,
              review_count: reviews.length,
            },
          };
        });

      setReviews(processedReviews);

      // Fetch user's favorite listings
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('favorites')
        .select(`
          listing_id,
          created_at,
          listings (
            id,
            url,
            title,
            location,
            source,
            created_at,
            current_price,
            image_url,
            listing_snapshots (
              price,
              scraped_at
            ),
            reviews (
              id,
              rating
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (favoritesError) {
        console.error('Error fetching favorites:', favoritesError);
        throw favoritesError;
      }

      const processedFavorites: Listing[] = (favoritesData || [])
        .filter((fav: any) => fav.listings)
        .map((fav: any) => {
          const listing = fav.listings;
          const snapshots = listing.listing_snapshots || [];
          const sortedSnapshots = snapshots.sort((a: any, b: any) =>
            new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
          );

          const latestPrice = sortedSnapshots[0]?.price || null;
          const previousPrice = sortedSnapshots[1]?.price || null;
          const priceChange = latestPrice && previousPrice ? latestPrice - previousPrice : null;

          const reviews = listing.reviews || [];
          const avgRating = reviews.length > 0
            ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
            : undefined;

          return {
            id: listing.id,
            url: listing.url,
            title: listing.title,
            location: listing.location || '',
            source: listing.source,
            created_at: listing.created_at,
            current_price: listing.current_price || latestPrice || 0,
            latest_price: latestPrice,
            price_change: priceChange,
            has_reviews: reviews.length > 0,
            review_count: reviews.length,
            image_url: listing.image_url,
            average_rating: avgRating,
          };
        });

      setFavorites(processedFavorites);
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
          <TabsTrigger value="favorites">
            Polubione ({favorites.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          {listings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nie dodałeś jeszcze żadnych ogłoszeń do śledzenia.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} {...listing} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nie dodałeś jeszcze żadnych komentarzy.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review) => (
                <ListingCard
                  key={review.id}
                  id={review.listing_id}
                  title={review.listing.title}
                  location={review.listing.location}
                  current_price={review.listing.current_price}
                  source={review.listing.source}
                  created_at={review.listing.created_at}
                  image_url={review.listing.image_url}
                  average_rating={review.listing.average_rating}
                  review_count={review.listing.review_count}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nie masz jeszcze żadnych polubionych ogłoszeń.
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favorites.map((listing) => (
                <ListingCard key={listing.id} {...listing} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
