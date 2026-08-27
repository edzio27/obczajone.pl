import type { Metadata } from 'next';
import { PartnerPanelClient } from './panel-client';

export const metadata: Metadata = {
  title: 'Panel partnera | obczajone.pl',
  description: 'Zapytania, opinie i statystyki Twojej firmy w serwisie obczajone.pl.',
  // Panel jest za logowaniem i nie ma żadnej wartości w wynikach wyszukiwania.
  robots: { index: false, follow: false },
};

export default function PartnerPanelPage() {
  return <PartnerPanelClient />;
}
