import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { fetchLatestInspectionByPartner, fetchPartners } from '@/lib/partner-data';
import { PartnersMapClient } from './partnerzy-client';

export const metadata: Metadata = {
  title: 'Partnerzy — diagnostyka aut i nieruchomości przed zakupem | obczajone.pl',
  description:
    'Firmy, które sprawdzają samochody i nieruchomości przed zakupem — z ocenami klientów i zapytaniem online. Znajdź partnera obczajone.pl w swoim województwie.',
  alternates: {
    canonical: '/partnerzy',
  },
  openGraph: {
    title: 'Partnerzy — diagnostyka aut i nieruchomości przed zakupem',
    description:
      'Firmy sprawdzające samochody i nieruchomości przed zakupem, z ocenami klientów.',
    url: '/partnerzy',
    type: 'website',
    locale: 'pl_PL',
    siteName: 'obczajone.pl',
  },
};

// Katalog zmienia się rzadko, a jest jedynym miejscem, z którego prowadzą linki
// do profili partnerów - musi wyjść z serwera, żeby te linki w ogóle trafiły do
// HTML-a, który widzi wyszukiwarka.
// 60, nie 600: treści partnerów przechodzą moderację, a moderator po
// zatwierdzeniu od razu sprawdza efekt. Przy dziesięciu minutach za każdym
// razem wygląda to tak, jakby zatwierdzenie nie zadziałało.
export const revalidate = 60;

export default async function PartnersMapPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const partners = await fetchPartners(supabase);
  const latestInspections = await fetchLatestInspectionByPartner(
    supabase,
    partners.map((p) => p.id)
  );

  return (
    <PartnersMapClient initialPartners={partners} latestInspections={latestInspections} />
  );
}
