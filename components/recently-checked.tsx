'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ListingCard } from '@/components/listing-card';

type Listing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string;
};

export function RecentlyChecked() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentlyChecked() {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, location, current_price, source, created_at, image_url')
        .eq('is_active', true)
        .gt('current_price', 0)
        .order('last_checked_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setListings(data);
      }
      setLoading(false);
    }

    fetchRecentlyChecked();
  }, []);

  if (loading || listings.length === 0) return null;

  return (
    <section aria-labelledby="ostatnio-sprawdzane">
      <h2
        id="ostatnio-sprawdzane"
        className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-left"
      >
        Ostatnio sprawdzane
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
    </section>
  );
}
