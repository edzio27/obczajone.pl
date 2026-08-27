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

      <div className={hasPartners ? 'grid md:grid-cols-2 gap-6' : 'max-w-2xl mx-auto'}>
        {partners.map((partner) => (
          <Card key={partner.id} className="bg-primary/5 border-primary/20 overflow-hidden">
            <Link
              href={`/partner/${partner.slug}`}
              className="p-6 flex items-center justify-between gap-4 flex-wrap h-full"
            >
              <div className="flex items-center gap-4">
                {partner.logo_url && (
                  <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                    <Image src={partner.logo_url} alt={partner.name} fill className="object-cover" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                    {partner.is_verified && <VerifiedBadge />}
                    {partner.is_promoted && <PromotedBadge />}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {partner.description}
                    {partner.city ? ` | ${partner.city}` : ''}
                  </p>
                  <div className="mt-2">
                    <PartnerStars
                      rating={partner.rating_avg}
                      count={partner.rating_count}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-medium shadow-md">
                Zobacz profil
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </Card>
        ))}

        <Card className="border-2 border-dashed border-gray-200 bg-white/50">
          <div className="p-6 flex items-center justify-between gap-4 flex-wrap h-full">
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
      </div>
    </section>
  );
}
