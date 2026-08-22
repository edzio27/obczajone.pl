import type { Metadata } from 'next';
import { PosrednicyClient } from './posrednicy-client';

export const metadata: Metadata = {
  title: 'Mapa pośredników i sprzedawców — opinie i oceny | obczajone.pl',
  description:
    'Przeglądaj mapę pośredników i sprzedawców z ogłoszeń Otomoto i Otodom. Sprawdź oceny, liczbę opinii i ile ich ogłoszeń zostało zweryfikowanych.',
  alternates: {
    canonical: '/posrednicy',
  },
  openGraph: {
    title: 'Mapa pośredników i sprzedawców — opinie i oceny',
    description:
      'Sprawdź oceny pośredników i sprzedawców z Otomoto i Otodom na mapie Polski.',
    url: '/posrednicy',
    type: 'website',
    locale: 'pl_PL',
    siteName: 'obczajone.pl',
  },
};

export default function PosrednicyPage() {
  return <PosrednicyClient />;
}
