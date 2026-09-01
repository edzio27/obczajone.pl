'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { checkRateLimit } from '@/lib/rate-limit';
import { Search, Loader as Loader2, ClipboardPaste, Check, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ListingUrlFormProps = {
  /** "ink" - wariant na ciemne sekcje (hero, dolne CTA). */
  tone?: 'light' | 'ink';
  className?: string;
};

function extractListingInfo(url: string) {
  const otomotoMatch = url.match(/otomoto\.pl\/(?:[^\/]+\/)?oferta\/[^\/]+-ID([A-Za-z0-9]+)/);
  const otodomMatch = url.match(/otodom\.pl\/[^\/]+\/oferta\/[^\/]+-ID([A-Za-z0-9]+)/);

  if (otomotoMatch) {
    return { source: 'otomoto' as const, listingId: otomotoMatch[1] };
  }
  if (otodomMatch) {
    return { source: 'otodom' as const, listingId: otodomMatch[1] };
  }
  return null;
}

export function ListingUrlForm({ tone = 'light', className }: ListingUrlFormProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const ink = tone === 'ink';

  // Rozpoznanie linku w locie. Do tej pory użytkownik dowiadywał się, że wkleił
  // coś nie tego, dopiero po kliknięciu - teraz widzi to od razu przy polu.
  const detected = useMemo(() => (url.trim() ? extractListingInfo(url.trim()) : null), [url]);
  const looksWrong = url.trim().length > 12 && !detected;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      // Odmowa dostępu do schowka albo brak wsparcia - użytkownikowi zostaje
      // zwykłe Ctrl+V, więc nie ma o czym go informować.
    }
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

      // Note: recording of the rate-limit action now happens atomically in a
      // database trigger (enforce_listing_rate_limit) alongside the insert
      // itself, so it can't be skipped by bypassing the client. No separate
      // client-side recordAction() call is needed (and doing it here too
      // would double-count against the limit).

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
    <form onSubmit={handleSubmit} className={cn('w-full max-w-3xl', className)}>
      <div
        className={cn(
          'group relative flex flex-col sm:flex-row items-stretch gap-2 rounded-[1.75rem] sm:rounded-full p-2 transition-all duration-300 ease-spring border',
          ink
            ? 'bg-white/[0.07] border-white/15 backdrop-blur-xl'
            : 'bg-card border-border shadow-lift',
          focused && (ink ? 'border-white/35 bg-white/[0.1]' : 'border-primary/45 shadow-glow'),
          detected && !loading && 'border-success/60'
        )}
      >
        <div className="relative flex flex-1 items-center min-w-0">
          <span
            className={cn(
              'pointer-events-none absolute left-4 flex h-6 w-6 items-center justify-center transition-colors',
              detected ? 'text-success' : ink ? 'text-white/45' : 'text-muted-foreground'
            )}
          >
            {detected ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
          </span>

          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Wklej link z Otomoto lub Otodom…"
            aria-label="Link do ogłoszenia z Otomoto lub Otodom"
            aria-invalid={looksWrong || undefined}
            className={cn(
              'w-full bg-transparent border-0 outline-none h-12 sm:h-14 pl-12 pr-3 text-[15px] sm:text-base truncate',
              ink
                ? 'text-white placeholder:text-white/45'
                : 'text-foreground placeholder:text-muted-foreground'
            )}
            required
            disabled={loading}
          />

          {!url && (
            <button
              type="button"
              onClick={handlePaste}
              className={cn(
                'hidden sm:inline-flex items-center gap-1.5 mr-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                ink
                  ? 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Wklej
            </button>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          size="xl"
          className="sm:h-14 h-12 px-6 sm:px-8 flex-shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Sprawdzam…
            </>
          ) : (
            <>
              <Search className="h-5 w-5 mr-2" />
              Sprawdź za darmo
            </>
          )}
        </Button>
      </div>

      <p
        className={cn(
          'mt-2.5 px-2 text-center sm:text-left text-xs transition-colors min-h-[1rem]',
          looksWrong
            ? ink
              ? 'text-orange-300'
              : 'text-destructive'
            : ink
              ? 'text-white/55'
              : 'text-muted-foreground'
        )}
      >
        {looksWrong
          ? 'To nie wygląda na link do oferty z Otomoto ani Otodom.'
          : detected
            ? `Rozpoznano ogłoszenie z ${detected.source === 'otomoto' ? 'Otomoto' : 'Otodom'} — kliknij, żeby sprawdzić.`
            : 'Bez konta, bez opłat. Wynik dostajesz od razu.'}
      </p>
    </form>
  );
}
