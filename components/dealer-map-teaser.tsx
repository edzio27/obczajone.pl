import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';

type DealerMapTeaserProps = {
  sellerCount: number | null;
  reviewCount: number | null;
};

export function DealerMapTeaser({ sellerCount, reviewCount }: DealerMapTeaserProps) {
  // Mapa ma dzis 157 posrednikow i zero ocen, a "157 posrednikow, 0 ocen"
  // reklamuje wlasnie to, czego brakuje. Liczby pokazujemy dopiero, gdy obie
  // mowia cos dobrego.
  const hasNumbers =
    sellerCount != null && reviewCount != null && sellerCount > 0 && reviewCount > 0;

  return (
    <Link href="/posrednicy" className="group block">
      <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift md:flex-row md:p-7">
        {/* Delikatna siatka „mapy” w tle, żeby kafelek zapowiadał to, dokąd prowadzi. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
            maskImage: 'radial-gradient(70% 100% at 8% 50%, #000, transparent)',
            WebkitMaskImage: 'radial-gradient(70% 100% at 8% 50%, #000, transparent)',
          }}
        />

        <span className="icon-tile relative h-14 w-14 flex-shrink-0 bg-primary/10 text-primary">
          <MapPin className="h-7 w-7" />
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl border border-primary/25 animate-pulse-ring"
          />
        </span>

        <div className="relative flex-1 text-center md:text-left">
          <h3 className="text-lg font-bold text-foreground md:text-xl">
            Zobacz miejsca, gdzie inni oglądali oferty
          </h3>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            {hasNumbers ? (
              <>
                <span className="font-semibold text-foreground tabular">{sellerCount}</span>{' '}
                pośredników i komisów,{' '}
                <span className="font-semibold text-foreground tabular">{reviewCount}</span> ocen
                użytkowników na mapie Polski
              </>
            ) : (
              'Komisy i pośrednicy oceniani przez użytkowników na mapie Polski'
            )}
          </p>
        </div>

        <span className="relative inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all duration-300 ease-spring group-hover:gap-3">
          Zobacz mapę
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
