'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ClipboardCheck } from 'lucide-react';
import { PartnerStars } from '@/components/partner/partner-stars';
import { VerifiedBadge } from '@/components/partner/partner-badges';
import { VERDICT_LABELS, type PartnerInspection } from '@/lib/partner-data';

const VERDICT_STYLES: Record<string, string> = {
  recommended: 'bg-success/10 text-success border-success/20',
  reservations: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  not_recommended: 'bg-destructive/10 text-destructive border-destructive/20',
};

/**
 * Werdykt firmy, która to auto realnie widziała. Stoi nad CTA partnerskim,
 * bo pierwszeństwo ma treść o tym konkretnym ogłoszeniu, a nie oferta usługi -
 * i dlatego, że nic innego na tej stronie nie jest oparte na oględzinach na żywo.
 */
export function ListingInspections({ inspections }: { inspections: PartnerInspection[] }) {
  if (inspections.length === 0) return null;

  return (
    <Card className="mb-6 border-success/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="h-5 w-5 text-success" />
          {inspections.length === 1
            ? 'Ten przedmiot był oglądany przez specjalistę'
            : 'Oględziny specjalistów'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {inspections.map((inspection) => (
          <div key={inspection.id}>
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-center gap-2.5">
                {inspection.partner?.logo_url && (
                  <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={inspection.partner.logo_url}
                      alt={inspection.partner.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {inspection.partner ? (
                      <Link
                        href={`/partner/${inspection.partner.slug}`}
                        className="font-semibold text-sm hover:text-primary transition-colors"
                      >
                        {inspection.partner.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-sm">Partner obczajone.pl</span>
                    )}
                    {inspection.partner?.is_verified && <VerifiedBadge />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {inspection.partner && (
                      <PartnerStars
                        rating={inspection.partner.rating_avg}
                        count={inspection.partner.rating_count}
                        size="sm"
                        showEmptyLabel={false}
                      />
                    )}
                    {inspection.inspected_at && (
                      <span className="text-xs text-muted-foreground">
                        oględziny{' '}
                        {format(new Date(inspection.inspected_at), 'd MMMM yyyy', { locale: pl })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

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
                    <span className="text-muted-foreground flex-shrink-0">•</span>
                    {finding}
                  </li>
                ))}
              </ul>
            )}

            {inspection.price_opinion && (
              <p className="text-sm text-gray-700 mt-3 bg-muted/40 rounded-lg p-3">
                <span className="font-medium">O cenie: </span>
                {inspection.price_opinion}
              </p>
            )}
          </div>
        ))}

        <p className="text-xs text-muted-foreground border-t pt-3">
          Wpisy publikują firmy współpracujące z obczajone.pl i przechodzą one moderację. To opinia
          konkretnego specjalisty, a nie stanowisko serwisu — nie zastępuje własnych oględzin.
        </p>
      </CardContent>
    </Card>
  );
}
