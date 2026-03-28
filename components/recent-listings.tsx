'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';

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

export function RecentListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchListings() {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          reviews(rating)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        const listingsWithRatings = data.map((listing: any) => {
          const reviews = listing.reviews || [];
          const avgRating = reviews.length > 0
            ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
            : undefined;

          return {
            ...listing,
            average_rating: avgRating,
            review_count: reviews.length,
          };
        });
        setListings(listingsWithRatings);
      }
      setLoading(false);
    }

    fetchListings();
  }, []);

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
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
          <CardTitle className="text-2xl">Brak ogłoszeń</CardTitle>
          <CardDescription className="text-base mt-2">
            Dodaj pierwsze ogłoszenie używając formularza powyżej
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((listing) => (
        <ListingCard key={listing.id} {...listing} />
      ))}
    </div>
  );
}
