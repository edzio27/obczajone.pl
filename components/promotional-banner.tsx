import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PartnerStars } from '@/components/partner/partner-stars';
import { PromotedBadge, VerifiedBadge } from '@/components/partner/partner-badges';
import type { Partner } from '@/lib/partner-data';

/**
 * Sekcja partnerów na stronie głównej. Renderowana serwerowo razem z resztą
 * strony - to jedyne miejsce, z którego prowadzą linki do profili partnerów
 * z najczęściej odwiedzanej strony w serwisie.
 */
export function PartnersSection({ partners }: { partners: Partner[] }) {
  const hasPartners = partners.length > 0;

  return (
    <section id="partnerzy" aria-labelledby="partnerzy-heading">
      <div className="text-center mb-8">
        <h2 id="partnerzy-heading" className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          {hasPartners ? 'Zaufani partnerzy' : 'Współpraca'}
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {hasPartners
            ? 'Firmy, które sprawdzają samochody i nieruchomości przed zakupem — z ocenami wystawionymi przez kupujących.'
            : 'Szukamy firm, które sprawdzają samochody i nieruchomości przed zakupem.'}
        </p>
      </div>

      {/*
        Jeden poziomy pas zamiast siatki. Partnerów będzie przybywać, a siatka
        rosnąca w dół spycha resztę strony głównej coraz niżej - pas trzyma stałą
        wysokość niezależnie od tego, czy firm jest dwie, czy dwadzieścia.
        Zaproszenie do współpracy jest ostatnim kafelkiem, więc widzi je ten,
        kto przewinął całą listę - czyli ktoś, kto szukał tam siebie.
      */}
      {hasPartners ? (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 snap-x">
          {partners.map((partner) => (
            <Card
              key={partner.id}
              className="w-64 flex-shrink-0 snap-start bg-primary/5 border-primary/20 overflow-hidden"
            >
              <Link href={`/partner/${partner.slug}`} className="p-4 flex flex-col h-full">
                <div className="flex items-center gap-3">
                  {partner.logo_url && (
                    <div className="relative w-11 h-11 rounded-full overflow-hidden shadow flex-shrink-0">
                      <Image
                        src={partner.logo_url}
                        alt={partner.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{partner.name}</h3>
                    {partner.city && <p className="text-xs text-gray-500">{partner.city}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <PartnerStars rating={partner.rating_avg} count={partner.rating_count} size="sm" />
                  {partner.is_verified && <VerifiedBadge />}
                  {partner.is_promoted && <PromotedBadge />}
                </div>

                <p className="text-xs text-gray-600 mt-2 line-clamp-2">{partner.description}</p>

                <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Zobacz profil
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Card>
          ))}

          <Card className="w-64 flex-shrink-0 snap-start border-2 border-dashed border-gray-200 bg-white/50">
            <div className="p-4 flex flex-col h-full">
              <h3 className="font-semibold text-gray-900 text-sm">Zostań naszym partnerem</h3>
              <p className="text-xs text-gray-600 mt-2">
                Sprawdzasz auta albo nieruchomości przed zakupem? Dostaniesz własną podstronę
                z opiniami i zapytania od kupujących.
              </p>
              <Link
                href="/dla-firm"
                className="mt-auto pt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
              >
                Zasady współpracy
                <Mail className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="max-w-2xl mx-auto border-2 border-dashed border-gray-200 bg-white/50">
          <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold text-gray-900">Zostań naszym partnerem</h3>
              <p className="text-sm text-gray-600 mt-1">
                Prowadzisz firmę zajmującą się diagnostyką lub sprawdzaniem aut albo nieruchomości
                przed zakupem? Dostaniesz własną podstronę z opiniami i zapytania od kupujących.
                Pierwsze trzy miesiące bez opłat.
              </p>
            </div>
            <Link
              href="/dla-firm"
              className="inline-flex items-center gap-2 border-2 border-primary text-primary px-6 py-3 rounded-lg hover:bg-primary hover:text-white transition-all font-medium flex-shrink-0"
            >
              Zasady współpracy
              <Mail className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}
