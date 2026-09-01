import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Handshake, Mail } from 'lucide-react';
import { PartnerStars } from '@/components/partner/partner-stars';
import { PromotedBadge, VerifiedBadge } from '@/components/partner/partner-badges';
import { SectionHeading } from '@/components/home/section-heading';
import { Reveal } from '@/components/motion/reveal';
import type { Partner } from '@/lib/partner-data';

/**
 * Sekcja partnerów na stronie głównej. Renderowana serwerowo razem z resztą
 * strony - to jedyne miejsce, z którego prowadzą linki do profili partnerów
 * z najczęściej odwiedzanej strony w serwisie.
 */
export function PartnersSection({ partners }: { partners: Partner[] }) {
  const hasPartners = partners.length > 0;

  return (
    <section className="mt-20" id="partnerzy" aria-labelledby="partnerzy-heading">
      <SectionHeading
        id="partnerzy-heading"
        eyebrow="Zaufani partnerzy"
        icon={Handshake}
        title={hasPartners ? 'Firmy, które pojadą za Ciebie' : 'Szukamy firm do współpracy'}
        description={
          hasPartners
            ? 'Sprawdzają samochody i nieruchomości przed zakupem. Oceny wystawiają kupujący, którzy z nich skorzystali.'
            : 'Sprawdzasz auta albo nieruchomości przed zakupem? Szukamy firm do katalogu.'
        }
        action={hasPartners ? { href: '/partnerzy', label: 'Zobacz wszystkie' } : undefined}
      />

      {/*
        Jeden poziomy pas zamiast siatki. Partnerów będzie przybywać, a siatka
        rosnąca w dół spycha resztę strony głównej coraz niżej - pas trzyma stałą
        wysokość niezależnie od tego, czy firm jest dwie, czy dwadzieścia.
        Zaproszenie do współpracy jest ostatnim kafelkiem, więc widzi je ten,
        kto przewinął całą listę - czyli ktoś, kto szukał tam siebie.
      */}
      {hasPartners ? (
        <Reveal>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
            {partners.map((partner) => (
              <Link
                key={partner.id}
                href={`/partner/${partner.slug}`}
                className="group w-[17rem] flex-shrink-0 snap-start"
              >
                <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-300 ease-spring hover:-translate-y-1 hover:border-primary/35 hover:shadow-lift">
                  <div className="flex items-center gap-3">
                    {partner.logo_url ? (
                      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-border">
                        <Image
                          src={partner.logo_url}
                          alt={partner.name}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-extrabold text-primary">
                        {partner.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                        {partner.name}
                      </h3>
                      {partner.city && (
                        <p className="truncate text-xs text-muted-foreground">{partner.city}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <PartnerStars rating={partner.rating_avg} count={partner.rating_count} size="sm" />
                    {partner.is_verified && <VerifiedBadge />}
                    {partner.is_promoted && <PromotedBadge />}
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {partner.description}
                  </p>

                  <span className="mt-auto inline-flex items-center gap-1.5 pt-3.5 text-sm font-semibold text-primary transition-all duration-300 ease-spring group-hover:gap-2.5">
                    Zobacz profil
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </article>
              </Link>
            ))}

            <Link href="/dla-firm" className="group w-[17rem] flex-shrink-0 snap-start">
              <article className="flex h-full flex-col rounded-2xl border border-dashed border-border bg-card/50 p-4 transition-colors hover:border-primary/40 hover:bg-card">
                <span className="icon-tile h-11 w-11 bg-signal/15 text-signal-foreground">
                  <Mail className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-foreground">Zostań naszym partnerem</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Sprawdzasz auta albo nieruchomości przed zakupem? Dostaniesz własną
                  podstronę z opiniami i zapytania od kupujących. Pierwsze trzy miesiące
                  bez opłat.
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-3.5 text-sm font-semibold text-primary transition-all duration-300 ease-spring group-hover:gap-2.5">
                  Zasady współpracy
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </article>
            </Link>
          </div>
        </Reveal>
      ) : (
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-6">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-foreground">Zostań naszym partnerem</h3>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Prowadzisz firmę zajmującą się diagnostyką lub sprawdzaniem aut albo
                nieruchomości przed zakupem? Dostaniesz własną podstronę z opiniami
                i zapytania od kupujących. Pierwsze trzy miesiące bez opłat.
              </p>
            </div>
            <Link
              href="/dla-firm"
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Zasady współpracy
              <Mail className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      )}
    </section>
  );
}
