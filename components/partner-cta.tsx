'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logPartnerClick } from '@/lib/partner-clicks';
import { distanceKm, formatDistance } from '@/lib/geo';
import { PartnerStars } from '@/components/partner/partner-stars';
import { VerifiedBadge } from '@/components/partner/partner-badges';
import { PartnerLeadDialog } from '@/components/partner/partner-lead-dialog';
import { comparePartners, PARTNER_COLUMNS, type Partner } from '@/lib/partner-data';

type PartnerWithDistance = Partner & { distance: number | null };

/**
 * Zasięg, w jakim uznajemy partnera za realnie dostępny. Firmy sprawdzające auta
 * zwykle dojeżdżają do klienta, więc promień jest hojny - ale odległość zawsze
 * pokazujemy wprost, żeby użytkownik sam ocenił, czy to dla niego sensowne.
 */
const MAX_DISTANCE_KM = 200;

type PartnerCtaProps = {
  source: 'otomoto' | 'otodom';
  listingId: string;
  /** Współrzędne sprzedającego - jedyny sygnał o tym, gdzie stoi przedmiot ogłoszenia. */
  listingLocation?: { lat: number; lng: number } | null;
};

export function PartnerCta({ source, listingId, listingLocation }: PartnerCtaProps) {
  const [partners, setPartners] = useState<PartnerWithDistance[]>([]);
  const [loaded, setLoaded] = useState(false);

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
        .filter((p) => p.distance == null || p.distance <= MAX_DISTANCE_KM)
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
        .slice(0, 8);

      setPartners(withDistance);
      setLoaded(true);
    }

    fetchPartners();
  }, [source, listingLocation]);

  if (!loaded) return null;

  // Pokazywanie eksperta z drugiego końca Polski psuje obie strony naraz:
  // użytkownik dostaje ofertę, z której nie skorzysta, a partner - lead, którego
  // nie obsłuży. Zamiast tego pytamy o polecenie i tak rekrutujemy kolejnych.
  if (partners.length === 0) {
    return (
      <Card className="mb-6 border-dashed border-2">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <h3 className="font-semibold text-gray-900">
              Nie mamy jeszcze partnera w tym regionie
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Szukamy firm, które sprawdzają auta przed zakupem w okolicy tego ogłoszenia.
            Znasz kogoś dobrego albo sam prowadzisz taką firmę? Daj znać.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dla-firm">Zasady współpracy</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="mailto:kontakt@obczajone.pl?subject=Polecam%20firm%C4%99%20sprawdzaj%C4%85c%C4%85%20auta">
                Poleć firmę
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-gray-900">Chcesz mieć pewność przed zakupem?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Opinia AI to dobry pierwszy sygnał, ale nie zastąpi oględzin na żywo. Zamów profesjonalne
          sprawdzenie u jednego z naszych zaufanych partnerów.
        </p>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex-shrink-0 w-60 rounded-lg border bg-white p-3 flex flex-col"
            >
              <Link
                href={`/partner/${partner.slug}`}
                onClick={() => logPartnerClick(partner.id, 'listing_cta', listingId)}
                className="flex-1"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {partner.logo_url && (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={partner.logo_url}
                        alt={partner.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <p className="font-medium text-sm truncate">{partner.name}</p>
                </div>

                {partner.rating_count > 0 ? (
                  <PartnerStars rating={partner.rating_avg} count={partner.rating_count} size="sm" />
                ) : (
                  partner.is_verified && <VerifiedBadge />
                )}

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
                context="listing_cta"
              >
                <Button size="sm" className="w-full mt-3">
                  Zamów sprawdzenie
                </Button>
              </PartnerLeadDialog>
            </div>
          ))}
        </div>

        <Link href="/partnerzy">
          <Button variant="outline" size="sm" className="mt-3">
            Zobacz więcej z Twojej okolicy
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
