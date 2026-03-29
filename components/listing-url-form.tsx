'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { checkRateLimit, recordAction } from '@/lib/rate-limit';
import { Search, Loader as Loader2 } from 'lucide-react';

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
    <form onSubmit={handleSubmit} className="w-full max-w-3xl">
      <p className="text-sm text-gray-700 mb-3 text-center">
        Zobacz, czy cena była manipulowana i czy inni użytkownicy zgłaszali problem
      </p>
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-2 rounded-2xl shadow-lg border-2 border-gray-100 hover:border-blue-200 transition-colors">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Wklej link do ogłoszenia..."
          className="flex-1 border-0 focus-visible:ring-0 text-base h-12 px-4"
          required
          disabled={loading}
        />
        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all font-semibold h-12 px-8"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Sprawdzanie...
            </>
          ) : (
            <>
              <Search className="h-5 w-5 mr-2" />
              Sprawdź ogłoszenie
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
