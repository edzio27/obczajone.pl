'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { LeafletMapView, escapeHtml, type MapMarker } from '@/components/leaflet-map';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const POLAND_CENTER: [number, number] = [52.0, 19.0];
const MIN_RATING_OPTIONS = [0, 3, 4, 4.5];

type SellerWithRating = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  averageRating: number | null;
  reviewCount: number;
};

export default function PosrednicyPage() {
  const [sellers, setSellers] = useState<SellerWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [minRating, setMinRating] = useState(0);

  useEffect(() => {
    async function fetchSellers() {
      const { data: sellersData } = await supabase
        .from('sellers')
        .select('id, name, city, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (!sellersData || sellersData.length === 0) {
        setLoading(false);
        return;
      }

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating, listing:listings!inner(seller_id)')
        .eq('is_approved', true)
        .in(
          'listing.seller_id',
          sellersData.map((s) => s.id)
        );

      const ratingsBySeller = new Map<string, number[]>();
      (reviewsData || []).forEach((review: any) => {
        const sellerId = review.listing?.seller_id;
        if (!sellerId) return;
        const existing = ratingsBySeller.get(sellerId) || [];
        existing.push(review.rating);
        ratingsBySeller.set(sellerId, existing);
      });

      setSellers(
        sellersData.map((s) => {
          const ratings = ratingsBySeller.get(s.id) || [];
          return {
            ...s,
            averageRating:
              ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
            reviewCount: ratings.length,
          };
        })
      );
      setLoading(false);
    }

    fetchSellers();
  }, []);

  const filteredSellers = sellers.filter((s) => {
    const matchesCity = cityFilter
      ? s.city.toLowerCase().includes(cityFilter.toLowerCase())
      : true;
    const matchesRating = minRating > 0 ? (s.averageRating ?? 0) >= minRating : true;
    return matchesCity && matchesRating;
  });

  const markers: MapMarker[] = filteredSellers.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    popupHtml: `<a href="/seller/${s.id}">${escapeHtml(s.name)}</a><br/>${escapeHtml(s.city)}${
      s.averageRating != null ? `<br/>⭐ ${s.averageRating.toFixed(1)} (${s.reviewCount})` : ''
    }`,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Pośrednicy na mapie</h1>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Filtruj po mieście"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="max-w-xs"
          />
          <Select value={String(minRating)} onValueChange={(v) => setMinRating(Number(v))}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Minimalna ocena" />
            </SelectTrigger>
            <SelectContent>
              {MIN_RATING_OPTIONS.map((rating) => (
                <SelectItem key={rating} value={String(rating)}>
                  {rating === 0 ? 'Dowolna ocena' : `${rating}+`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : filteredSellers.length === 0 ? (
          <p className="text-muted-foreground">Brak pośredników spełniających kryteria.</p>
        ) : (
          <LeafletMapView markers={markers} center={POLAND_CENTER} zoom={6} heightClassName="h-[600px]" />
        )}

        <p className="text-sm text-muted-foreground">
          {filteredSellers.length} pośrednik(ów) na mapie. Zobacz też{' '}
          <Link href="/" className="text-primary hover:underline">
            stronę główną
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
