import type { Metadata } from 'next';
import { PartnersMapClient } from './partnerzy-client';

export const metadata: Metadata = {
  title: 'Partnerzy — diagnostyka aut i nieruchomości przed zakupem | obczajone.pl',
  description:
    'Mapa firm, które sprawdzają samochody i nieruchomości przed zakupem. Znajdź partnera obczajone.pl w swoim województwie.',
  alternates: {
    canonical: '/partnerzy',
  },
  openGraph: {
    title: 'Partnerzy — diagnostyka aut i nieruchomości przed zakupem',
    description:
      'Mapa firm sprawdzających samochody i nieruchomości przed zakupem.',
    url: '/partnerzy',
    type: 'website',
    locale: 'pl_PL',
    siteName: 'obczajone.pl',
  },
};

export default function PartnersMapPage() {
  return <PartnersMapClient />;
}
