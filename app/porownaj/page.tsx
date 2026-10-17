import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { CompareView } from '@/components/compare-view';

/*
  Treść tej strony zależy od tego, co ktoś dodał u siebie w przeglądarce,
  więc dla wyszukiwarki jest pusta - stąd noindex. Linki zostawiamy do śledzenia.
*/
export const metadata: Metadata = {
  title: 'Porównanie aut — cena, obniżki i ocena na tle rynku | obczajone.pl',
  description:
    'Porównaj do pięciu aut z Otomoto obok siebie: cena, historia obniżek, dni w ogłoszeniu, przebieg i ocena ceny na tle podobnych ofert.',
  alternates: { canonical: '/porownaj' },
  robots: { index: false, follow: true },
};

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Porównanie aut</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Do pięciu ofert obok siebie, z tym, czego nie widać w samym ogłoszeniu: jak zmieniała się
              cena, ile razy sprzedający ją obniżał i jak wypada na tle podobnych aut. Lista zostaje
              w tej przeglądarce, bez zakładania konta.
            </p>
          </div>
          <Suspense fallback={null}>
            <CompareView />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
