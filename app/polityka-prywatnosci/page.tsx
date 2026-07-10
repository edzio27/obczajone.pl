import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Polityka prywatności — obczajone.pl',
  description: 'Polityka prywatności serwisu obczajone.pl.',
  robots: { index: false, follow: false },
};

const sections = [
  {
    title: '1. Administrator danych',
    note: 'Do uzupełnienia: dane administratora danych osobowych.',
  },
  {
    title: '2. Jakie dane przetwarzamy',
    note: 'Do uzupełnienia: konto użytkownika, treść opinii, zdjęcia, adresy e-mail.',
  },
  {
    title: '3. Cel i podstawa przetwarzania',
    note: 'Do uzupełnienia: świadczenie usługi, moderacja treści, zapobieganie nadużyciom.',
  },
  {
    title: '4. Prawa użytkownika',
    note: 'Do uzupełnienia: prawo dostępu, sprostowania, usunięcia danych (RODO).',
  },
  {
    title: '5. Pliki cookies',
    note: 'Do uzupełnienia: rodzaje wykorzystywanych plików cookies i cel ich użycia.',
  },
  {
    title: '6. Kontakt w sprawie danych',
    note: 'Do uzupełnienia: sposób kontaktu w sprawach ochrony danych osobowych.',
  },
];

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Polityka prywatności</h1>
        <p className="text-gray-600 mb-8">
          Ta strona jest szkieletem polityki prywatności i wymaga uzupełnienia o docelowe zapisy przed publikacją.
        </p>
        <div className="space-y-6">
          {sections.map(({ title, note }) => (
            <section key={title}>
              <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
              <p className="text-gray-500 text-sm italic">[{note}]</p>
            </section>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-8">
          Kontakt:{' '}
          <a href="mailto:kontakt@obczajone.pl" className="hover:text-primary transition-colors">
            kontakt@obczajone.pl
          </a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
