'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { checkRateLimit, recordAction } from '@/lib/rate-limit';
import { Search } from 'lucide-react';

export function ListingUrlForm() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const extractListingInfo = (url: string) => {
    const otomotoMatch = url.match(/otomoto\.pl\/(?:osobowe\/)?oferta\/[^\/]+-ID([A-Za-z0-9]+)/);
    const otodomMatch = url.match(/otodom\.pl\/[^\/]+\/oferta\/[^\/]+-ID([A-Za-z0-9]+)/);

    if (otomotoMatch) {
      return { source: 'otomoto' as const, listingId: otomotoMatch[1] };
    }
    if (otodomMatch) {
      return { source: 'otodom' as const, listingId: otodomMatch[1] };
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const listingInfo = extractListingInfo(url);

    if (!listingInfo) {
      toast({
        title: 'Nieprawidłowy URL',
        description: 'Podaj prawidłowy link do ogłoszenia z Otomoto lub Otodom',
        variant: 'destructive',
      });
      return;
    }

    if (user) {
      const canProceed = await checkRateLimit(user.id, 'add_listing', 5, 60);

      if (!canProceed) {
        toast({
          title: 'Limit przekroczony',
          description: 'Możesz dodać maksymalnie 5 ogłoszeń na godzinę',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);

    try {
      const { data: existing, error: searchError } = await supabase
        .from('listings')
        .select('id')
        .eq('listing_id', listingInfo.listingId)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existing) {
        router.push(`/listing/${existing.id}`);
        return;
      }

      const { data: newListing, error: insertError } = await supabase
        .from('listings')
        .insert({
          listing_id: listingInfo.listingId,
          source: listingInfo.source,
          url: url.trim(),
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (user) {
        await recordAction(user.id, 'add_listing');
      }

      toast({
        title: 'Ogłoszenie dodane',
        description: 'Trwa pobieranie danych...',
      });

      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scrape-listing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId: newListing.id }),
      });

      router.push(`/listing/${newListing.id}`);
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message || 'Nie udało się dodać ogłoszenia',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Wklej link do ogłoszenia z Otomoto lub Otodom"
          className="flex-1"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? (
            'Wyszukiwanie...'
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Sprawdź
            </>
          )}
        </Button>
      </div>
      <p className="text-sm text-gray-500 mt-2">
        Wspieramy ogłoszenia z Otomoto.pl i Otodom.pl
      </p>
    </form>
  );
}
