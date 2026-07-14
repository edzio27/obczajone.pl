'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ListingCard } from '@/components/listing-card';
import { computePriceChangePercent } from '@/lib/price-change';

type Listing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string;
  priceChangePercent: number;
};

export function BiggestPriceDrops() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDrops() {
      const { data: pool, error } = await supabase
        .from('listings')
        .select('id, title, location, current_price, source, created_at, image_url')
        .eq('is_active', true)
        .order('last_checked_at', { ascending: false })
        .limit(100);

      if (error || !pool || pool.length === 0) {
        setLoading(false);
        return;
      }

      const ids = pool.map((l) => l.id);
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

      const withDrops = pool
        .map((listing) => {
          const earliestPrice = earliestPriceByListing.get(listing.id);
          const percent =
            earliestPrice != null
              ? computePriceChangePercent(listing.current_price, earliestPrice)
              : null;
          return { ...listing, priceChangePercent: percent };
        })
        .filter(
          (l): l is Listing => l.priceChangePercent != null && l.priceChangePercent < 0
        )
        .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
        .slice(0, 3);

      setListings(withDrops);
      setLoading(false);
    }

    fetchDrops();
  }, []);

  if (loading || listings.length === 0) return null;

  return (
    <section aria-labelledby="najwieksze-obnizki">
      <h2
        id="najwieksze-obnizki"
        className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-left"
      >
        Największe obniżki
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
    </section>
  );
}
