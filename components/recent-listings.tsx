'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, Search } from 'lucide-react';
import { fetchRecentListings, type HomeListing } from '@/lib/home-data';

type RecentListingsProps = {
  pageSize?: number;
  /** Pierwsza strona wyników wyrenderowana serwerowo - trafia do HTML-a. */
  initialListings?: HomeListing[];
};

export function RecentListings({ pageSize = 9, initialListings = [] }: RecentListingsProps) {
  const [listings, setListings] = useState<HomeListing[]>(initialListings);
  const [loading, setLoading] = useState(initialListings.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(initialListings.length === pageSize);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Pierwsza strona przyszła z serwera, więc pomijamy pobranie przy montowaniu.
  // Kolejne przebiegi (zmiana wyszukiwania) odpytują bazę normalnie.
  const skipInitialFetch = useRef(initialListings.length > 0);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    let cancelled = false;

    async function fetchFirstPage() {
      setError(false);
      setLoading(true);

      const data = await fetchRecentListings(supabase, {
        pageSize,
        page: 0,
        search: debouncedQuery,
      });

      if (cancelled) return;

      setListings(data);
      setHasMore(data.length === pageSize);
      setPage(0);
      setLoading(false);
    }

    fetchFirstPage();

    return () => {
      cancelled = true;
    };
  }, [pageSize, debouncedQuery]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;

    const data = await fetchRecentListings(supabase, {
      pageSize,
      page: nextPage,
      search: debouncedQuery,
    });

    setListings((prev) => [...prev, ...data]);
    setHasMore(data.length === pageSize);
    setPage(nextPage);
    setLoadingMore(false);
  }

  const searchBox = (
    <div className="relative mb-6 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Szukaj po tytule..."
        className="pl-9"
      />
    </div>
  );

  if (loading) {
    return (
      <div>
        {searchBox}
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
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {searchBox}
        <Card className="border-dashed border-2 border-red-200">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-2xl">Nie udało się wczytać ogłoszeń</CardTitle>
            <CardDescription className="text-base mt-2">
              Wystąpił błąd podczas pobierania danych. Spróbuj odświeżyć stronę.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div>
        {searchBox}
        <Card className="border-dashed border-2">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-2xl">Brak ogłoszeń</CardTitle>
            <CardDescription className="text-base mt-2">
              {debouncedQuery
                ? `Brak ogłoszeń pasujących do „${debouncedQuery}"`
                : 'Dodaj pierwsze ogłoszenie używając formularza powyżej'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {searchBox}
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
