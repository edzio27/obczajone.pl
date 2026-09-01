'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Loader as Loader2, Search, X } from 'lucide-react';
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
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Szukaj po tytule, np. Golf VII…"
        aria-label="Szukaj wśród sprawdzonych ogłoszeń"
        className="h-12 rounded-full border-border bg-card pl-11 pr-11 shadow-soft focus-visible:ring-offset-0"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          aria-label="Wyczyść wyszukiwanie"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div>
        {searchBox}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-2xl border border-border bg-card p-3.5 shadow-soft"
            >
              <div className="h-[104px] w-[104px] flex-shrink-0 animate-pulse rounded-xl bg-muted sm:h-[124px] sm:w-[124px]" />
              <div className="flex-1 space-y-2.5 py-1">
                <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
                <div className="h-6 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {searchBox}
        <Card className="border-2 border-dashed border-destructive/30 bg-card/60">
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
        <Card className="border-2 border-dashed bg-card/60">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Button onClick={loadMore} disabled={loadingMore} variant="outline" size="lg">
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ładowanie…
              </>
            ) : (
              <>
                Załaduj więcej
                <ChevronDown className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
