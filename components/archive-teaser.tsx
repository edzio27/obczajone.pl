import Link from 'next/link';
import { ArrowRight, Archive } from 'lucide-react';

type ArchiveTeaserProps = {
  /** Ile zdjętych ogłoszeń mamy opisanych. Null, gdy nie udało się policzyć. */
  archivedCount: number | null;
};

/**
 * Wejście do archiwum ze strony głównej.
 *
 * Linkujemy stąd, a nie tylko ze stopki, bo to jedyna strona serwisu z realną
 * pozycją w wyszukiwarce (1.1 na "historia cen otomoto") — a archiwum ma
 * najwięcej wyświetleń ze wszystkich grup zapytań przy najgorszej pozycji: 628
 * wyświetleń na średniej 7.7, czyli na dole pierwszej strony i niżej.
 */
export function ArchiveTeaser({ archivedCount }: ArchiveTeaserProps) {
  return (
    <Link href="/archiwum-otomoto" className="group block">
      <div className="flex flex-col items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift md:flex-row md:p-7">
        <span className="icon-tile h-14 w-14 flex-shrink-0 bg-primary/10 text-primary">
          <Archive className="h-7 w-7" />
        </span>

        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg font-bold text-foreground md:text-xl">
            Szukasz ogłoszenia, które zniknęło z Otomoto?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
            {archivedCount != null && archivedCount > 0 ? (
              <>
                <span className="font-semibold text-foreground tabular">
                  {archivedCount.toLocaleString('pl-PL')}
                </span>{' '}
                archiwalnych ogłoszeń z zapisaną ceną i historią obniżek. Otomoto po zdjęciu
                oferty kasuje stronę — u nas zostaje.
              </>
            ) : (
              'Archiwalne ogłoszenia z zapisaną ceną i historią obniżek. Otomoto po zdjęciu oferty kasuje stronę — u nas zostaje.'
            )}
          </p>
        </div>

        <span className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all duration-300 ease-spring group-hover:gap-3">
          Zobacz archiwum
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
