import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { DigestOptInClient } from './digest-opt-in-client';

export const maxDuration = 10;

export const metadata: Metadata = {
  title: 'Cotygodniowe podsumowanie | obczajone.pl',
  // Strona dla jednej osoby z jednym linkiem, jak wypisanie.
  robots: { index: false, follow: false },
};

export default function DigestOptInPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-16 flex-1">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center space-y-3">
            <DigestOptInClient token={params.token} />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
