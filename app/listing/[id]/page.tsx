'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReviewForm } from '@/components/review-form';
import { ReviewList } from '@/components/review-list';
import { PriceHistory } from '@/components/price-history';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, MapPin, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

type Listing = {
  id: string;
  listing_id: string;
  source: string;
  url: string;
  title: string;
  location: string;
  current_price: number;
  is_active: boolean;
  first_seen_at: string;
  last_checked_at: string;
};

type Snapshot = {
  id: string;
  price: number;
  title: string;
  description: string;
  photo_urls: string[];
  metadata: any;
  scraped_at: string;
};

export default function ListingPage() {
  const params = useParams();
  const listingId = params.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

      if (listingError) {
        console.error('Error fetching listing:', listingError);
        setLoading(false);
        return;
      }

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('listing_snapshots')
        .select('*')
        .eq('listing_id', listingId)
        .order('scraped_at', { ascending: false });

      if (!snapshotsError) {
        setSnapshots(snapshotsData || []);
      }

      setListing(listingData);
      setLoading(false);
    }

    fetchData();
  }, [listingId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50">
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

  const latestSnapshot = snapshots[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={listing.source === 'otomoto' ? 'default' : 'secondary'}>
                      {listing.source}
                    </Badge>
                    {!listing.is_active && (
                      <Badge variant="outline">Nieaktywne</Badge>
                    )}
                  </div>
                  <CardTitle className="text-3xl mb-2">
                    {listing.title || latestSnapshot?.title || 'Ładowanie...'}
                  </CardTitle>
                  <CardDescription className="text-base">
                    <div className="flex flex-wrap gap-4 mt-2">
                      {listing.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {listing.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Dodano{' '}
                        {formatDistanceToNow(new Date(listing.first_seen_at), {
                          addSuffix: true,
                          locale: pl,
                        })}
                      </span>
                    </div>
                  </CardDescription>
                </div>
                <div className="text-right">
                  {listing.current_price > 0 && (
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {listing.current_price.toLocaleString('pl-PL')} zł
                    </div>
                  )}
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    Zobacz oryginalne ogłoszenie
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Tabs defaultValue="reviews" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="reviews">Opinie</TabsTrigger>
              <TabsTrigger value="history">Historia</TabsTrigger>
              <TabsTrigger value="details">Szczegóły</TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="space-y-6">
              <ReviewForm listingId={listingId} />
              <ReviewList listingId={listingId} />
            </TabsContent>

            <TabsContent value="history">
              <PriceHistory snapshots={snapshots} />
            </TabsContent>

            <TabsContent value="details">
              {latestSnapshot ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Najnowsze szczegóły</CardTitle>
                    <CardDescription>
                      Pobrano{' '}
                      {formatDistanceToNow(new Date(latestSnapshot.scraped_at), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {latestSnapshot.description && (
                        <div>
                          <h3 className="font-semibold mb-2">Opis</h3>
                          <p className="whitespace-pre-wrap text-gray-600">
                            {latestSnapshot.description}
                          </p>
                        </div>
                      )}
                      {latestSnapshot.photo_urls?.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2">Zdjęcia</h3>
                          <div className="grid grid-cols-3 gap-4">
                            {latestSnapshot.photo_urls.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Zdjęcie ${idx + 1}`}
                                className="w-full h-48 object-cover rounded-lg"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Brak danych</CardTitle>
                    <CardDescription>
                      Trwa pobieranie szczegółów ogłoszenia...
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
