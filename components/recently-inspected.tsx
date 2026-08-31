import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ListingThumbnail } from '@/components/listing-thumbnail';
import { VERDICT_LABELS, type InspectionVerdict } from '@/lib/partner-data';
import type { InspectedListing } from '@/lib/home-data';

const VERDICT_STYLES: Record<string, string> = {
  recommended: 'bg-success/10 text-success border-success/20',
  reservations: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  not_recommended: 'bg-destructive/10 text-destructive border-destructive/20',
};

/**
 * Auta, które partner faktycznie obejrzał na żywo.
 *
 * To jedyna treść w serwisie, której nie ma nikt inny w internecie - i jedyna,
 * przy której da się powiedzieć czytelnikowi coś więcej niż to, co stoi
 * w ogłoszeniu. Dlatego stoi na stronie głównej, a nie tylko na profilach firm.
 */
export function RecentlyInspected({ listings }: { listings: InspectedListing[] }) {
  if (listings.length === 0) return null;

  return (
    <section aria-labelledby="ostatnio-obejrzane">
      <h2
        id="ostatnio-obejrzane"
        className="text-2xl md:text-3xl font-bold text-foreground mb-1 text-left"
      >
        Obejrzane na żywo
      </h2>
      <p className="text-gray-600 mb-6">
        Auta, przy których nasz partner był osobiście i wystawił werdykt.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <Link href={`/listing/${listing.id}`} className="flex gap-4 p-4">
              <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                <ListingThumbnail src={listing.image_url} alt={listing.title} />
              </div>

              <div className="flex-1 min-w-0">
                <Badge
                  variant="outline"
                  className={VERDICT_STYLES[listing.verdict] ?? ''}
                >
                  {VERDICT_LABELS[listing.verdict as InspectionVerdict] ?? 'Werdykt'}
                </Badge>

                <h3 className="font-semibold text-sm mt-1.5 line-clamp-2">{listing.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{listing.location}</p>
                <p className="font-bold text-primary mt-1">
                  {listing.current_price.toLocaleString('pl-PL')} zł
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  sprawdził {listing.partnerName}
                </p>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
