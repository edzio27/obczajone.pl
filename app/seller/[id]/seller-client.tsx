'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ListingCard } from '@/components/listing-card';
import { LeafletMapView, escapeHtml } from '@/components/leaflet-map';
import { findOtherBranches, type SellerBranch } from '@/lib/seller-name';
import { MapPin, Star } from 'lucide-react';

type Seller = {
  id: string;
  source: string;
  name: string;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type SellerListing = {
  id: string;
  title: string | null;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string | null;
};

export function SellerClient({ sellerId }: { sellerId: string }) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [otherBranches, setOtherBranches] = useState<SellerBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: sellerData, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (sellerError || !sellerData) {
        console.error('Error fetching seller:', sellerError);
        setLoading(false);
        return;
      }

      setSeller(sellerData);

      const { data: listingsData } = await supabase
        .from('listings')
        .select('id, title, location, current_price, source, created_at, image_url')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      setListings(listingsData || []);

      if (listingsData && listingsData.length > 0) {
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('rating')
          .in(
            'listing_id',
            listingsData.map((l) => l.id)
          )
          .eq('is_approved', true);

        if (reviewsData && reviewsData.length > 0) {
          setReviewCount(reviewsData.length);
          setAverageRating(
            reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length
          );
        }
      }

      const { data: sameNetworkCandidates } = await supabase
        .from('sellers')
        .select('id, name, city')
        .eq('source', sellerData.source)
        .neq('id', sellerId);

      if (sameNetworkCandidates) {
        setOtherBranches(findOtherBranches(sellerData, sameNetworkCandidates));
      }

      setLoading(false);
    }

    fetchData();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Sprzedawca nie został znaleziony.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{seller.name}</CardTitle>
            <CardDescription className="text-base space-y-2 mt-2">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {seller.address ? `${seller.address}, ${seller.city}` : seller.city}
              </div>
              {averageRating != null && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({reviewCount} opinii)</span>
                </div>
              )}
            </CardDescription>
          </CardHeader>
          {seller.lat != null && seller.lng != null && (
            <CardContent>
              <LeafletMapView
                markers={[
                  {
                    id: seller.id,
                    lat: seller.lat,
                    lng: seller.lng,
                    popupHtml: escapeHtml(seller.name),
                  },
                ]}
                center={[seller.lat, seller.lng]}
                zoom={14}
              />
            </CardContent>
          )}
        </Card>

        {otherBranches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inne oddziały tej sieci</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {otherBranches.map((branch) => (
                <Link
                  key={branch.id}
                  href={`/seller/${branch.id}`}
                  className="text-primary hover:underline"
                >
                  {branch.name} — {branch.city}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Auta tego sprzedawcy ({listings.length})</h2>
          {listings.length === 0 ? (
            <p className="text-muted-foreground">Brak ogłoszeń.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} {...listing} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
