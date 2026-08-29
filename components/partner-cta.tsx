'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { PartnerCard, useNearbyPartners } from '@/components/partner/partner-picker';

type PartnerCtaProps = {
  source: 'otomoto' | 'otodom';
  listingId: string;
  /** Współrzędne sprzedającego - jedyny sygnał o tym, gdzie stoi przedmiot ogłoszenia. */
  listingLocation?: { lat: number; lng: number } | null;
  /**
   * Rzeczy, które opinia AI kazała sprawdzić na żywo. Zaproszenie do oględzin,
   * które wynika z tego konkretnego ogłoszenia, jest czymś innym niż ogólne
   * "zamów sprawdzenie" - mówi, czego dokładnie nie wiadomo ze zdjęć.
   */
  watchOutFor?: string[];
};

export function PartnerCta({
  source,
  listingId,
  listingLocation,
  watchOutFor = [],
}: PartnerCtaProps) {
  const { partners, loaded } = useNearbyPartners(source, listingLocation);

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

  const hasWatchOut = watchOutFor.length > 0;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-gray-900">
            {hasWatchOut
              ? `${watchOutFor.length} ${
                  watchOutFor.length < 5 ? 'rzeczy' : 'rzeczy'
                }, których nie sprawdzisz ze zdjęć`
              : 'Chcesz mieć pewność przed zakupem?'}
          </h3>
        </div>

        {hasWatchOut ? (
          <>
            <ul className="text-sm text-gray-700 space-y-1 mb-3 mt-2">
              {watchOutFor.slice(0, 3).map((point, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span className="line-clamp-1">{point}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-600 mb-4">
              To są rzeczy, które ktoś musi zobaczyć na żywo. Poniższe firmy pojadą na miejsce
              i sprawdzą je przed Twoim zakupem.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-600 mb-4">
            Opinia AI to dobry pierwszy sygnał, ale nie zastąpi oględzin na żywo. Zamów
            profesjonalne sprawdzenie u jednego z naszych zaufanych partnerów.
          </p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {partners.slice(0, 3).map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              listingId={listingId}
              context="listing_cta"
            />
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
