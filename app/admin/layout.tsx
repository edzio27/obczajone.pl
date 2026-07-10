import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panel Administratora | obczajone.pl',
  description: 'Panel administracyjny obczajone.pl do zarządzania recenzjami i zgłoszeniami.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
