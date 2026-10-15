import Link from 'next/link';
import { largePhotoUrl } from '@/lib/photo-url';
import type { RecentDrop } from '@/lib/market-trends';

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

/** Karty aut, które właśnie potaniały - na /trendy-cen i na stronach modeli. */
export function RecentDropsGrid({ drops }: { drops: RecentDrop[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {drops.map((d) => {
        const percent = ((d.toPrice - d.fromPrice) / d.fromPrice) * 100;
        return (
          <Link
            key={d.id}
            href={`/listing/${d.id}`}
            className="group overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div className="aspect-[4/3] bg-muted">
              {d.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={largePhotoUrl(d.imageUrl)} alt={d.title} loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-4">
              <p className="font-semibold truncate">{d.title}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold">{formatPln(d.toPrice)}</span>
                <span className="text-sm text-muted-foreground line-through">{formatPln(d.fromPrice)}</span>
                <span className="ml-auto font-semibold text-success">
                  −{Math.abs(percent).toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%
                </span>
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
