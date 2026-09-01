'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { logPartnerClick } from '@/lib/partner-clicks';
import { distanceKm, formatDistance } from '@/lib/geo';
import { PartnerStars } from '@/components/partner/partner-stars';
import { VerifiedBadge } from '@/components/partner/partner-badges';
import { PartnerLeadDialog } from '@/components/partner/partner-lead-dialog';
import { comparePartners, inspectionCountLabel, PARTNER_COLUMNS, type Partner } from '@/lib/partner-data';

export type PartnerWithDistance = Partner & { distance: number | null };

/**
 * Ostatnia deska ratunku, gdy żaden partner nie ma tego regionu w swoim zasięgu.
 * Powyżej tego progu oferta przestaje być ofertą: kupujący nie zamówi firmy
 * z drugiego końca kraju, a firma i tak by odmówiła.
 */
const FALLBACK_MAX_KM = 350;

/**
 * Dobór partnerów pod konkretne ogłoszenie. Wydzielony z sekcji CTA, bo ta sama
 * lista jest teraz potrzebna w dwóch miejscach: w sekcji pod opinią AI i w oknie
 * otwieranym przyciskiem przy samym ogłoszeniu.
 */
export function useNearbyPartners(
  source: 'otomoto' | 'otodom',
  listingLocation?: { lat: number; lng: number } | null
) {
  const [partners, setPartners] = useState<PartnerWithDistance[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Prawda, gdy pokazujemy firmę spoza jej własnego zasięgu, bo nie ma innej. */
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    async function fetchPartners() {
      const category = source === 'otomoto' ? 'car' : 'home';
      const { data } = await supabase
        .from('partners')
        .select(PARTNER_COLUMNS)
        .eq('category', category)
        .eq('is_active', true);

      const all = ((data as unknown as Partner[]) || []).sort(comparePartners);

      // Bez współrzędnych ogłoszenia nie mamy jak ocenić odległości, więc
      // pokazujemy wszystkich zamiast zgadywać.
      if (!listingLocation) {
        setPartners(all.slice(0, 8).map((p) => ({ ...p, distance: null })));
        setLoaded(true);
        return;
      }

      const withDistance = all
        .map((p) => ({
          ...p,
          distance:
            p.lat != null && p.lng != null
              ? distanceKm(listingLocation, { lat: p.lat, lng: p.lng })
              : null,
        }))
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

      // Zasięg deklaruje partner, nie my - jedna firma obsługuje województwo,
      // inna pół kraju, a wspólny próg krzywdzi obie.
      const inRange = withDistance.filter(
        (p) => p.distance == null || p.distance <= (p.service_radius_km ?? 200)
      );

      if (inRange.length > 0) {
        setPartners(inRange.slice(0, 8));
        setIsFallback(false);
        setLoaded(true);
        return;
      }

      /*
        Nikt nie ma tego regionu w zasięgu. Zamiast pustego kafelka pokazujemy
        najbliższą firmę z wyraźną odległością - wyłączności to nie narusza,
        bo mówi ona "nikt inny w Twoim regionie", a tu regionu nie ma nikt.
      */
      const nearest = withDistance.filter(
        (p) => p.distance != null && p.distance <= FALLBACK_MAX_KM
      );

      setPartners(nearest.slice(0, 3));
      setIsFallback(nearest.length > 0);
      setLoaded(true);
    }

    fetchPartners();
  }, [source, listingLocation]);

  return { partners, loaded, isFallback };
}

export function PartnerCard({
  partner,
  listingId,
  context,
}: {
  partner: PartnerWithDistance;
  listingId: string;
  /*
   * Oba miejsca raportują się jako `listing_cta`, bo taką wartość dopuszcza
   * CHECK na `partner_clicks` i `partner_leads`. Rozdzielenie lejka „przycisk
   * przy ogłoszeniu” od „sekcja pod opinią AI” wymaga migracji - jest gotowa
   * w scripts/, do uruchomienia wtedy, gdy będzie ruch wart rozdzielania.
   */
  context: 'listing_cta';
}) {
  return (
    <div className="rounded-lg border bg-white p-3 flex flex-col">
      <Link
        href={`/partner/${partner.slug}`}
        onClick={() => logPartnerClick(partner.id, context, listingId)}
        className="flex-1"
      >
        <div className="flex items-center gap-2 mb-1.5">
          {partner.logo_url && (
            <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <Image src={partner.logo_url} alt={partner.name} fill className="object-cover" />
            </div>
          )}
          <p className="font-medium text-sm truncate">{partner.name}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {partner.rating_count > 0 ? (
            <PartnerStars rating={partner.rating_avg} count={partner.rating_count} size="sm" />
          ) : (
            partner.is_verified && <VerifiedBadge />
          )}
          {/* Liczba opublikowanych werdyktów jest tym, czym firma bez ocen może
              się wykazać - i tym, co odróżnia ją od nazwy w spisie. */}
          {partner.inspection_count > 0 && (
            <span className="text-xs text-muted-foreground">
              {inspectionCountLabel(partner.inspection_count)}
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 line-clamp-2 mt-1.5">{partner.description}</p>
        <p className="text-xs text-gray-400 mt-1">
          {partner.city}
          {partner.distance != null && ` · ${formatDistance(partner.distance)}`}
          {partner.price_from != null &&
            ` · od ${Number(partner.price_from).toLocaleString('pl-PL')} zł`}
        </p>
      </Link>

      <PartnerLeadDialog
        partnerId={partner.id}
        partnerName={partner.name}
        listingId={listingId}
        context={context}
      >
        <Button size="sm" variant="signal" className="w-full mt-3">
          Zamów sprawdzenie
        </Button>
      </PartnerLeadDialog>
    </div>
  );
}
