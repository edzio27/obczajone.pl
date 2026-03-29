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

  useEffect(() => {
    async function fetchListings() {
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select(`
          listing_id,
          created_at,
          listings(*)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && reviewsData) {
        const uniqueListings = new Map();

        for (const review of reviewsData) {
          const listing: any = review.listings;
          if (listing && typeof listing === 'object' && !Array.isArray(listing) && !uniqueListings.has(listing.id)) {
            const { data: allReviews } = await supabase
              .from('reviews')
              .select('rating')
              .eq('listing_id', listing.id);

            const reviews = allReviews || [];
            const avgRating = reviews.length > 0
              ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
              : undefined;

            uniqueListings.set(listing.id, {
              ...listing,
              average_rating: avgRating,
              review_count: reviews.length,
            });

            if (uniqueListings.size >= limit) break;
          }
        }

        setListings(Array.from(uniqueListings.values()));
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
      <div className={showMoreButton ? "flex flex-col sm:flex-row gap-4 items-stretch" : "grid md:grid-cols-2 lg:grid-cols-3 gap-6"}>
        {displayedListings.map((listing) => (
          <div key={listing.id} className={showMoreButton ? "w-full sm:flex-1 flex" : ""}>
            <ListingCard {...listing} />
          </div>
        ))}
        {showMoreButton && !showAll && listings.length > 3 && (
          <Button
            onClick={() => setShowAll(true)}
            variant="outline"
            className="whitespace-nowrap flex items-center justify-center min-h-[200px]"
          >
            Pokaż więcej
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
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
