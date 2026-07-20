'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { MapPin, Star } from 'lucide-react';

export function DealerMapTeaser() {
  const [sellerCount, setSellerCount] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCounts() {
      const { count: sellers } = await supabase
        .from('sellers')
        .select('id', { count: 'exact', head: true })
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      const { count: reviews } = await supabase
        .from('reviews')
        .select('id, listing:listings!inner(seller_id)', { count: 'exact', head: true })
        .eq('is_approved', true)
        .not('listing.seller_id', 'is', null);

      setSellerCount(sellers ?? 0);
      setReviewCount(reviews ?? 0);
    }

    fetchCounts();
  }, []);

  return (
    <Link href="/posrednicy">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 hover:bg-primary/10 transition-colors p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 cursor-pointer">
        <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <MapPin className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
            Zobacz miejsca, gdzie inni oglądali samochody
          </h3>
          <p className="text-muted-foreground">
            {sellerCount != null && reviewCount != null ? (
              <>
                Ponad {sellerCount} pośredników i komisów, {reviewCount} ocen użytkowników na mapie Polski
              </>
            ) : (
              'Komisy i pośrednicy oceniani przez użytkowników na mapie Polski'
            )}
          </p>
        </div>
        <Button className="flex-shrink-0 gap-2">
          <Star className="h-4 w-4" />
          Zobacz mapę
        </Button>
      </div>
    </Link>
  );
}
