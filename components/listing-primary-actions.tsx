'use client';

import { ExternalLink, FileSearch } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InspectionCtaButton } from '@/components/partner/inspection-cta-button';
import { useNearbyPartners } from '@/components/partner/partner-picker';
import { logAffiliateClick } from '@/lib/affiliate-clicks';
import {
  VIN_AFFILIATE_URL,
  VIN_AFFILIATE_NAME,
  VIN_AFFILIATE_PROVIDER,
  VIN_AFFILIATE_DISCOUNT_CODE,
  VIN_AFFILIATE_DISCOUNT_PERCENT,
  hasVinAffiliate,
} from '@/lib/vin-affiliate';

type ListingPrimaryActionsProps = {
  source: 'otomoto' | 'otodom';
  listingId: string;
  listingUrl: string;
  listingLocation?: { lat: number; lng: number } | null;
  watchOutCount?: number;
};

/**
 * Akcje przy cenie ogłoszenia, trzymane razem, bo o kolejności między nimi
 * decyduje ta sama odpowiedź z bazy.
 *
 * Od 26.10.2026 przy aucie pierwszy jest raport VIN. To jedyne kliknięcie na
 * tej stronie, które dziś przynosi pieniądze (prowizja od sprzedaży), a stał
 * dotąd w karcie pod historią i oceną ceny: od 18.10 na 446 wejść na ogłoszenia
 * jedno kliknięcie, przy siedmiu w „Zamów inspekcję" stojące tu, przy cenie.
 * Zamówienie oględzin zostaje zaraz pod nim, wypełnione, ale już bez pomarańczu.
 * Karta o VIN-ie niżej zostaje bez zmian - z bezpłatnym rejestrem na początku.
 *
 * "Zobacz oryginalne ogłoszenie" wysyła odwiedzającego na Otomoto, skąd zwykle
 * już nie wraca - więc stoi niżej, w obwódce, razem z alertem i udostępnianiem.
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
  const hasVin = source === 'otomoto' && hasVinAffiliate;

  return (
    <>
      {hasVin && (
        <div>
          <a
            href={VIN_AFFILIATE_URL}
            target="_blank"
            // `sponsored` to wymóg Google dla linków płatnych.
            rel="sponsored nofollow noopener noreferrer"
            // Ten sam licznik co karta niżej; w ui_events rozróżnia je podpis.
            data-track={`${VIN_AFFILIATE_NAME} przy cenie`}
            onClick={() => logAffiliateClick(VIN_AFFILIATE_PROVIDER as string, 'listing', listingId)}
            className={cn(buttonVariants({ variant: 'signal', size: 'lg' }), 'w-full gap-2')}
          >
            <FileSearch className="h-4 w-4" />
            Sprawdź VIN w {VIN_AFFILIATE_NAME}
          </a>
          {/* Oznaczenie przy samym przycisku, a nie w stopce - płacimy
              prowizję od tego kliknięcia (umowa, pkt 1.3). */}
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            Link partnerski
            {VIN_AFFILIATE_DISCOUNT_CODE && VIN_AFFILIATE_DISCOUNT_PERCENT && (
              <>
                {' · '}z kodem{' '}
                <code className="font-mono font-semibold text-foreground">
                  {VIN_AFFILIATE_DISCOUNT_CODE}
                </code>{' '}
                taniej o {VIN_AFFILIATE_DISCOUNT_PERCENT}%
              </>
            )}
          </p>
        </div>
      )}
      {hasInspection && (
        <InspectionCtaButton
          source={source}
          listingId={listingId}
          partners={partners}
          loaded={loaded}
          isFallback={isFallback}
          watchOutCount={watchOutCount}
          variant={hasVin ? 'default' : 'signal'}
        />
      )}
      <a
        href={listingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: hasInspection || hasVin ? 'outline' : 'default' }),
          'w-full gap-2'
        )}
      >
        Zobacz oryginalne ogłoszenie
        <ExternalLink className="h-4 w-4" />
      </a>
    </>
  );
}
