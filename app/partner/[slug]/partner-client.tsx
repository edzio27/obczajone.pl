'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { logPartnerClick } from '@/lib/partner-clicks';
import { PartnerStars } from '@/components/partner/partner-stars';
import { PromotedBadge, VerifiedBadge } from '@/components/partner/partner-badges';
import { PartnerLeadDialog } from '@/components/partner/partner-lead-dialog';
import { PartnerReviewForm } from '@/components/partner/partner-review-form';
import { PartnerReviewList } from '@/components/partner/partner-review-list';
import { ListingThumbnail } from '@/components/listing-thumbnail';
import {
  fetchPartnerReviews,
  VERDICT_LABELS,
  type Partner,
  type PartnerInspection,
  type PartnerReview,
} from '@/lib/partner-data';
import {
  ArrowLeft,
  CalendarClock,
  CircleCheck as CheckCircle2,
  ClipboardCheck,
  Clock,
  Globe,
  MapPin,
  Phone,
  Wallet,
} from 'lucide-react';

const VERDICT_STYLES: Record<string, string> = {
  recommended: 'bg-success/10 text-success border-success/20',
  reservations: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  not_recommended: 'bg-destructive/10 text-destructive border-destructive/20',
};

type PartnerClientProps = {
  partner: Partner;
  initialReviews: PartnerReview[];
  inspections: PartnerInspection[];
};

export function PartnerClient({ partner, initialReviews, inspections }: PartnerClientProps) {
  const [reviews, setReviews] = useState<PartnerReview[]>(initialReviews);

  const refreshReviews = useCallback(async () => {
    const fresh = await fetchPartnerReviews(supabase, partner.id);
    setReviews(fresh);
  }, [partner.id]);

  useEffect(() => {
    setReviews(initialReviews);
  }, [initialReviews]);

  const categoryLabel =
    partner.category === 'car' ? 'Sprawdzanie samochodów' : 'Sprawdzanie nieruchomości';

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Link
            href="/partnerzy"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wszyscy partnerzy
          </Link>

          <Card className="overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-5">
                {partner.logo_url ? (
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                    <Image src={partner.logo_url} alt={partner.name} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="h-9 w-9 text-primary" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h1 className="text-2xl font-bold text-foreground">{partner.name}</h1>
                    {partner.is_verified && <VerifiedBadge />}
                    {partner.is_promoted && <PromotedBadge />}
                  </div>

                  <p className="text-gray-600">{partner.description}</p>

                  <div className="flex items-center gap-3 flex-wrap mt-3">
                    <PartnerStars rating={partner.rating_avg} count={partner.rating_count} />
                    <Badge variant="secondary">{categoryLabel}</Badge>
                    {partner.city && (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {partner.city}
                        {partner.voivodeship ? `, ${partner.voivodeship}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <PartnerLeadDialog
                  partnerId={partner.id}
                  partnerName={partner.name}
                  context="partner_page"
                >
                  <Button size="lg" className="shadow-md">
                    Zamów sprawdzenie
                  </Button>
                </PartnerLeadDialog>

                {partner.phone && (
                  <Button variant="outline" size="lg" asChild>
                    <a href={`tel:${partner.phone.replace(/\s/g, '')}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      {partner.phone}
                    </a>
                  </Button>
                )}

                <Button variant="outline" size="lg" asChild>
                  <a
                    href={partner.website || partner.contact_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={() => logPartnerClick(partner.id, 'partners_page')}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Strona firmy
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="Opublikowane oględziny"
              value={partner.inspection_count > 0 ? String(partner.inspection_count) : '—'}
            />
            <StatTile
              icon={<Wallet className="h-4 w-4" />}
              label="Cena od"
              value={partner.price_from != null ? `${Number(partner.price_from).toLocaleString('pl-PL')} zł` : '—'}
            />
            <StatTile
              icon={<Clock className="h-4 w-4" />}
              label="Czas reakcji"
              value={partner.response_time || '—'}
            />
            <StatTile
              icon={<CalendarClock className="h-4 w-4" />}
              label="Partner od"
              value={
                partner.partner_since
                  ? new Date(partner.partner_since).toLocaleDateString('pl-PL', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
          </div>

          {(partner.about || partner.services.length > 0) && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                {partner.about && (
                  <div>
                    <h2 className="font-semibold text-lg mb-2">O firmie</h2>
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">{partner.about}</p>
                  </div>
                )}

                {partner.services.length > 0 && (
                  <div>
                    {partner.about && <Separator className="mb-5" />}
                    <h2 className="font-semibold text-lg mb-3">Zakres usług</h2>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {partner.services.map((service) => (
                        <li key={service} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                          {service}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {inspections.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-1">Oględziny opublikowane w serwisie</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Werdykty tej firmy przy konkretnych ogłoszeniach — najlepszy dowód, jak pracuje.
              </p>

              <div className="space-y-3">
                {inspections.map((inspection) => (
                  <Card key={inspection.id}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Werdykt bez zdjęcia zmusza do kliknięcia w ogłoszenie, żeby
                            w ogóle wiedzieć, o czym mowa. Miniatura z linkiem robi z tej
                            listy coś, co da się przejrzeć wzrokiem. */}
                        <Link
                          href={`/listing/${inspection.listing_id}`}
                          className="group w-full h-32 sm:w-28 sm:h-28 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center"
                        >
                          <ListingThumbnail
                            src={inspection.listing?.image_url ?? null}
                            alt={inspection.listing?.title || 'Zdjęcie ogłoszenia'}
                          />
                        </Link>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <Link
                              href={`/listing/${inspection.listing_id}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {inspection.listing?.title || 'Ogłoszenie'}
                            </Link>
                            <Badge variant="outline" className={VERDICT_STYLES[inspection.verdict]}>
                              {VERDICT_LABELS[inspection.verdict]}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                            {inspection.summary}
                          </p>
                          {inspection.findings.length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {inspection.findings.map((finding, index) => (
                                <li key={index} className="text-sm text-gray-600 flex gap-2">
                                  <span className="text-muted-foreground">•</span>
                                  {finding}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold mb-1">
              Opinie o firmie {partner.name}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Opinie wystawiają zalogowani użytkownicy i każda przechodzi moderację. Oznaczenie
              „Kontakt przez obczajone.pl” dostają autorzy, którzy wcześniej wysłali do tej firmy
              zapytanie przez nasz serwis.
            </p>

            <div className="space-y-4">
              <PartnerReviewList reviews={reviews} partnerName={partner.name} />
              <PartnerReviewForm
                partnerId={partner.id}
                partnerName={partner.name}
                onSubmitted={refreshReviews}
              />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}
