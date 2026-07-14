'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { computePriceChangePercent } from '@/lib/price-change';

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
  priceChangePercent?: number | null;
};

async function attachPriceChanges(listings: any[]): Promise<Listing[]> {
  if (listings.length === 0) return [];

  const ids = listings.map((l) => l.id);
  const { data: snapshotsData } = await supabase
    .from('listing_snapshots')
    .select('listing_id, price, scraped_at')
    .in('listing_id', ids)
    .order('scraped_at', { ascending: true });

  const earliestPriceByListing = new Map<string, number>();
  for (const snap of snapshotsData || []) {
    if (!earliestPriceByListing.has(snap.listing_id)) {
      earliestPriceByListing.set(snap.listing_id, snap.price);
    }
  }

  return listings.map((listing) => {
    const reviews = listing.reviews || [];
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : undefined;
    const earliestPrice = earliestPriceByListing.get(listing.id);

    return {
      ...listing,
      average_rating: avgRating,
      review_count: reviews.length,
      priceChangePercent: earliestPrice != null
        ? computePriceChangePercent(listing.current_price, earliestPrice)
        : null,
    };
  });
}

export function RecentListings({ pageSize = 9 }: { pageSize?: number }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    async function fetchFirstPage() {
      setError(false);
      setLoading(true);
      let query = supabase
        .from('listings')
        .select('*, reviews(rating)')
        .gt('current_price', 0);

      if (debouncedQuery) {
        query = query.ilike('title', `%${debouncedQuery}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(0, pageSize - 1);

      if (!error && data) {
        const withPriceChanges = await attachPriceChanges(data);
        setListings(withPriceChanges);
        setHasMore(data.length === pageSize);
        setPage(0);
      } else if (error) {
        console.error('Error fetching listings:', error);
        setError(true);
      }
      setLoading(false);
    }

    fetchFirstPage();
  }, [pageSize, debouncedQuery]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('listings')
      .select('*, reviews(rating)')
      .gt('current_price', 0);

    if (debouncedQuery) {
      query = query.ilike('title', `%${debouncedQuery}%`);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      const withPriceChanges = await attachPriceChanges(data);
      setListings((prev) => [...prev, ...withPriceChanges]);
      setHasMore(data.length === pageSize);
      setPage(nextPage);
    } else if (error) {
      console.error('Error fetching more listings:', error);
    }
    setLoadingMore(false);
  }

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

  if (error) {
    return (
      <Card className="border-dashed border-2 border-red-200">
        <CardHeader className="text-center py-12">
          <CardTitle className="text-2xl">Nie udało się wczytać ogłoszeń</CardTitle>
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
          <CardTitle className="text-2xl">Brak ogłoszeń</CardTitle>
          <CardDescription className="text-base mt-2">
            Dodaj pierwsze ogłoszenie używając formularza powyżej
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            variant="outline"
            size="lg"
            className="flex items-center gap-2"
          >
            {loadingMore ? 'Ładowanie...' : 'Załaduj więcej'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
