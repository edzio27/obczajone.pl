'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ShieldCheck } from 'lucide-react';
import { PartnerCard, useNearbyPartners } from '@/components/partner/partner-picker';

type InspectionCtaButtonProps = {
  source: 'otomoto' | 'otodom';
  listingId: string;
  listingLocation?: { lat: number; lng: number } | null;
  /** Ile rzeczy opinia AI kazała obejrzeć na żywo - to jest cały argument. */
  watchOutCount?: number;
};

/**
 * Główna akcja komercyjna, postawiona przy samym ogłoszeniu - obok "zobacz
 * ogłoszenie" i alertu cenowego, a nie dopiero w sekcji niżej.
 *
 * Świadomie przycisk otwierający okno, a nie popup wyskakujący sam: strony
 * ogłoszeń są jedynym źródłem ruchu z wyszukiwarki, a Google obniża pozycje
 * stron z natrętnymi interstitialami na mobile. Okno otwarte kliknięciem tej
 * zasady nie narusza, bo to użytkownik je wywołał.
 */
export function InspectionCtaButton({
  source,
  listingId,
  listingLocation,
  watchOutCount = 0,
}: InspectionCtaButtonProps) {
  const [open, setOpen] = useState(false);
  const { partners, loaded } = useNearbyPartners(source, listingLocation);

  const what = source === 'otomoto' ? 'auto' : 'nieruchomość';

  if (loaded && partners.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/5">
          <ShieldCheck className="h-4 w-4 mr-2" />
          Zamów inspekcję
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kto może obejrzeć to {what} na żywo</DialogTitle>
          <DialogDescription>
            {watchOutCount > 0
              ? `Opinia AI wskazała ${watchOutCount} ${
                  watchOutCount === 1 ? 'rzecz' : watchOutCount < 5 ? 'rzeczy' : 'rzeczy'
                }, których nie da się sprawdzić ze zdjęć. Poniższe firmy pojadą i je obejrzą.`
              : 'Ze zdjęć i opisu nie da się ocenić stanu technicznego. Poniższe firmy pojadą na miejsce i sprawdzą to za Ciebie.'}
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Szukamy firm w okolicy…</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              {partners.map((partner) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  listingId={listingId}
                  context="listing_cta"
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Zapytanie trafia bezpośrednio do firmy — nie pobieramy prowizji od ceny oględzin.{' '}
              <Link href="/partnerzy" className="underline hover:text-primary">
                Zobacz wszystkich partnerów
              </Link>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
