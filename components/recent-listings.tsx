'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';

type Listing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  url: string;
};

export function RecentListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchListings() {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setListings(data);
      }
      setLoading(false);
    }

    fetchListings();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brak ogłoszeń</CardTitle>
          <CardDescription>
            Dodaj pierwsze ogłoszenie używając formularza powyżej
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Ostatnio sprawdzone</h2>
      {listings.map((listing) => (
        <Link key={listing.id} href={`/listing/${listing.id}`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate">
                    {listing.title || 'Ładowanie tytułu...'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span>{listing.location || 'Brak lokalizacji'}</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(listing.created_at), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={listing.source === 'otomoto' ? 'default' : 'secondary'}>
                    {listing.source}
                  </Badge>
                  {listing.current_price > 0 && (
                    <div className="text-lg font-semibold text-gray-900">
                      {listing.current_price.toLocaleString('pl-PL')} zł
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
