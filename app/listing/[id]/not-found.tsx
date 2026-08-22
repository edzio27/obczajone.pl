import Link from 'next/link';
import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ListingNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Nie znaleziono ogłoszenia</CardTitle>
            <CardDescription>
              To ogłoszenie nie istnieje w naszej bazie albo zostało z niej usunięte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className="text-primary font-medium hover:underline">
              Wróć na stronę główną i sprawdź inne ogłoszenie
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
