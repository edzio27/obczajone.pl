import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MapPin, Star } from 'lucide-react';

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
    <Link href="/posrednicy">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 hover:bg-primary/10 transition-colors p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 cursor-pointer">
        <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <MapPin className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
            Zobacz miejsca, gdzie inni oglądali oferty
          </h3>
          <p className="text-muted-foreground">
            {hasNumbers ? (
              <>
                {sellerCount} pośredników i komisów, {reviewCount} ocen użytkowników na mapie Polski
              </>
            ) : (
              'Komisy i pośrednicy oceniani przez użytkowników na mapie Polski'
            )}
          </p>
        </div>
        <Button className="flex-shrink-0 gap-2">
          <Star className="h-4 w-4" />
          Zobacz mapę
        </Button>
      </div>
    </Link>
  );
}
