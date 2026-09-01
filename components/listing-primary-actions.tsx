'use client';

import { ExternalLink } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InspectionCtaButton } from '@/components/partner/inspection-cta-button';
import { useNearbyPartners } from '@/components/partner/partner-picker';

type ListingPrimaryActionsProps = {
  source: 'otomoto' | 'otodom';
  listingId: string;
  listingUrl: string;
  listingLocation?: { lat: number; lng: number } | null;
  watchOutCount?: number;
};

/**
 * Dwie akcje przy ogłoszeniu trzymane razem, bo o kolejności między nimi
 * decyduje ta sama odpowiedź z bazy.
 *
 * Zamówienie oględzin jest akcją główną: to jedyne kliknięcie na tej stronie,
 * które zostaje u nas i coś przynosi. "Zobacz oryginalne ogłoszenie" wysyła
 * odwiedzającego na Otomoto, skąd zwykle już nie wraca - więc stoi niżej,
 * w obwódce, razem z alertem cenowym i udostępnianiem.
 *
 * Gdy dla ogłoszenia nie ma żadnej firmy, link do ogłoszenia wraca na zielono.
 * Dotyczy to dziś wszystkich ogłoszeń z Otodom, bo w kategorii nieruchomości
 * nie mamy jeszcze partnera - a karta, w której żaden przycisk się nie wyróżnia,
 * nie mówi odwiedzającemu, co ma zrobić.
 */
export function ListingPrimaryActions({
  source,
  listingId,
  listingUrl,
  listingLocation,
  watchOutCount = 0,
}: ListingPrimaryActionsProps) {
  const { partners, loaded, isFallback } = useNearbyPartners(source, listingLocation);

  /*
    Podczas ładowania zakładamy, że firma się znajdzie - tak jest przy 95%
    ogłoszeń. Odwrotne założenie kazałoby przemalować przycisk na zielono
    i z powrotem przy każdym wejściu na stronę.
  */
  const hasInspection = !loaded || partners.length > 0;

  return (
    <>
      {hasInspection && (
        <InspectionCtaButton
          source={source}
          listingId={listingId}
          partners={partners}
          loaded={loaded}
          isFallback={isFallback}
          watchOutCount={watchOutCount}
        />
      )}
      <a
        href={listingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: hasInspection ? 'outline' : 'default' }),
          'w-full gap-2'
        )}
      >
        Zobacz oryginalne ogłoszenie
        <ExternalLink className="h-4 w-4" />
      </a>
    </>
  );
}
