import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mój Profil | obczajone.pl',
  description: 'Zarządzaj swoimi ogłoszeniami, opiniami i polubionymi ofertami na obczajone.pl.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
