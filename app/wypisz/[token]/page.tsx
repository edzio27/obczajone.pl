import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { UnsubscribeClient } from './unsubscribe-client';

export const metadata: Metadata = {
  title: 'Wypisanie z powiadomień | obczajone.pl',
  // Strona istnieje dla jednej osoby z jednym linkiem - token nie ma czego
  // szukać w indeksie wyszukiwarki.
  robots: { index: false, follow: false },
};

export default function UnsubscribePage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-16 flex-1">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center space-y-3">
            <UnsubscribeClient token={params.token} />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
