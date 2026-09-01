'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
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
import { Card } from '@/components/ui/card';
import { MapPin, Star } from 'lucide-react';

const POLAND_CENTER: [number, number] = [52.0, 19.0];
const MIN_RATING_OPTIONS = [0, 3, 4, 4.5];
const SORT_OPTIONS = [
  { value: 'rating', label: 'Najlepiej oceniani' },
  { value: 'reviewCount', label: 'Najwięcej ocen' },
  { value: 'listingsCount', label: 'Najczęściej sprawdzani' },
  { value: 'recent', label: 'Ostatnio ocenieni' },
] as const;

type SellerWithRating = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  averageRating: number | null;
  reviewCount: number;
  listingsCount: number;
  lastReviewAt: string | null;
};

export function PosrednicyClient() {
  const [sellers, setSellers] = useState<SellerWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]['value']>('rating');

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

      const sellerIds = sellersData.map((s) => s.id);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating, created_at, listing:listings!inner(seller_id)')
        .eq('is_approved', true)
        .in('listing.seller_id', sellerIds);

      const { data: listingsData } = await supabase
        .from('listings')
        .select('seller_id')
        .in('seller_id', sellerIds);

      const ratingsBySeller = new Map<string, number[]>();
      const lastReviewBySeller = new Map<string, string>();
      (reviewsData || []).forEach((review: any) => {
        const sellerId = review.listing?.seller_id;
        if (!sellerId) return;
        const existing = ratingsBySeller.get(sellerId) || [];
        existing.push(review.rating);
        ratingsBySeller.set(sellerId, existing);

        const current = lastReviewBySeller.get(sellerId);
        if (!current || review.created_at > current) {
          lastReviewBySeller.set(sellerId, review.created_at);
        }
      });

      const listingsCountBySeller = new Map<string, number>();
      (listingsData || []).forEach((l) => {
        if (!l.seller_id) return;
        listingsCountBySeller.set(l.seller_id, (listingsCountBySeller.get(l.seller_id) || 0) + 1);
      });

      setSellers(
        sellersData.map((s) => {
          const ratings = ratingsBySeller.get(s.id) || [];
          return {
            ...s,
            averageRating:
              ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
            reviewCount: ratings.length,
            listingsCount: listingsCountBySeller.get(s.id) || 0,
            lastReviewAt: lastReviewBySeller.get(s.id) || null,
          };
        })
      );
      setLoading(false);
    }

    fetchSellers();
  }, []);

  const filteredSellers = sellers
    .filter((s) => {
      const matchesCity = cityFilter
        ? s.city.toLowerCase().includes(cityFilter.toLowerCase())
        : true;
      const matchesRating = minRating > 0 ? (s.averageRating ?? 0) >= minRating : true;
      return matchesCity && matchesRating;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'reviewCount':
          return b.reviewCount - a.reviewCount;
        case 'listingsCount':
          return b.listingsCount - a.listingsCount;
        case 'recent':
          return (b.lastReviewAt || '').localeCompare(a.lastReviewAt || '');
        case 'rating':
        default:
          return (b.averageRating ?? -1) - (a.averageRating ?? -1);
      }
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
        <div className="mb-2">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">
            Pośrednicy na mapie
          </h1>
          <p className="mt-2 text-muted-foreground text-pretty">
            Komisy, dealerzy i pośrednicy, u których ktoś już oglądał ofertę — z ocenami
            wystawionymi po wizycie.
          </p>
        </div>

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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Sortuj" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
          <div className="grid lg:grid-cols-2 gap-4">
            <LeafletMapView markers={markers} center={POLAND_CENTER} zoom={6} heightClassName="h-[600px]" />

            <div className="h-[600px] overflow-y-auto space-y-3 pr-1">
              {filteredSellers.map((seller) => (
                <Link key={seller.id} href={`/seller/${seller.id}`}>
                  <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{seller.name}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {seller.city}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {seller.averageRating != null && (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold">{seller.averageRating.toFixed(1)}</span>
                            <span className="text-muted-foreground">({seller.reviewCount})</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {seller.listingsCount} sprawdzonych aut
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {filteredSellers.length} pośrednik(ów) na mapie. Zobacz też{' '}
          <Link href="/" className="text-primary hover:underline">
            stronę główną
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
