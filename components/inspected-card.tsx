import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight } from 'lucide-react';
import { ListingThumbnail } from '@/components/listing-thumbnail';
import { VERDICT_LABELS, type InspectionVerdict } from '@/lib/partner-data';
import type { InspectedListing } from '@/lib/home-data';
import { cn } from '@/lib/utils';

const VERDICT_STYLES: Record<string, string> = {
  recommended: 'bg-success/10 text-success border-success/25',
  reservations: 'bg-warning/15 text-warning-foreground border-warning/30',
  not_recommended: 'bg-destructive/10 text-destructive border-destructive/25',
};

/**
 * Jedno auto obejrzane przez partnera na żywo.
 *
 * Wydzielone ze strony głównej, bo ten sam kafelek stoi teraz w dwóch
 * miejscach: w zajawce na głównej i na pełnej liście werdyktów. Skopiowany
 * kawałek rozjechałby się przy pierwszej zmianie stylu, a to jest treść, przy
 * której wygląd niesie znaczenie - kolor odznaki mówi, czy partner odradził.
 */
export function InspectedCard({ listing }: { listing: InspectedListing }) {
  return (
    <Link href={`/listing/${listing.id}`} className="group block h-full">
      <article className="flex h-full gap-4 rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all duration-300 ease-spring hover:-translate-y-1 hover:border-primary/35 hover:shadow-lift">
        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
          <ListingThumbnail src={listing.image_url} alt={listing.title} />
        </div>

        <div className="min-w-0 flex-1">
          <Badge variant="outline" className={cn(VERDICT_STYLES[listing.verdict] ?? '')}>
            {VERDICT_LABELS[listing.verdict as InspectionVerdict] ?? 'Werdykt'}
          </Badge>

          <h3 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-primary">
            {listing.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{listing.location}</p>

          <div className="mt-1.5 flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-extrabold tabular text-foreground">
                {listing.current_price.toLocaleString('pl-PL')}
                <span className="ml-1 text-xs font-bold text-muted-foreground">zł</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                sprawdził {listing.partnerName}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-all duration-300 ease-spring group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </div>
      </article>
    </Link>
  );
}
