'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

type Listing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  url: string;
  image_url: string;
  average_rating?: number;
  review_count?: number;
};

export function RecentReviews({ limit = 3, showMoreButton = false }: { limit?: number; showMoreButton?: boolean }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchListings() {
      setError(false);
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select('listing_id')
        .order('created_at', { ascending: false })
        .limit(limit * 3);

      if (error) {
        console.error('Error fetching recent reviews:', error);
        setError(true);
      } else if (reviewsData) {
        const uniqueIds: string[] = [];
        for (const r of reviewsData) {
          if (!uniqueIds.includes(r.listing_id)) {
            uniqueIds.push(r.listing_id);
            if (uniqueIds.length >= limit) break;
          }
        }

        if (uniqueIds.length > 0) {
          const { data: listingsData } = await supabase
            .from('listings')
            .select('*, reviews(rating)')
            .in('id', uniqueIds);

          if (listingsData) {
            const sorted = uniqueIds
              .map((id) => listingsData.find((l: any) => l.id === id))
              .filter(Boolean) as any[];

            const withRatings = sorted.map((listing: any) => {
              const reviews = listing.reviews || [];
              const avgRating = reviews.length > 0
                ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
                : undefined;
              return { ...listing, average_rating: avgRating, review_count: reviews.length };
            });

            setListings(withRatings);
          }
        }
      }
      setLoading(false);
    }

    fetchListings();
  }, [limit]);

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="border-gray-200">
            <CardHeader>
              <div className="space-y-3">
                <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-dashed border-2 border-red-200">
        <CardHeader className="text-center py-12">
          <CardTitle className="text-2xl">Nie udało się wczytać opinii</CardTitle>
          <CardDescription className="text-base mt-2">
            Wystąpił błąd podczas pobierania danych. Spróbuj odświeżyć stronę.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (listings.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="text-center py-12">
          <CardTitle className="text-2xl">Brak skomentowanych ogłoszeń</CardTitle>
          <CardDescription className="text-base mt-2">
            Bądź pierwszym, który zostawi komentarz
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const displayedListings = showMoreButton && !showAll ? listings.slice(0, 3) : listings;

  return (
    <div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedListings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
      {showMoreButton && !showAll && listings.length > 3 && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={() => setShowAll(true)}
            variant="outline"
            size="lg"
            className="flex items-center gap-2"
          >
            Pokaż więcej
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {showMoreButton && showAll && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {listings.slice(3).map((listing) => (
            <ListingCard key={listing.id} {...listing} />
          ))}
        </div>
      )}
    </div>
  );
}
