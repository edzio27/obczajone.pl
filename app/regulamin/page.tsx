import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Regulamin serwisu — obczajone.pl',
  description: 'Regulamin korzystania z serwisu obczajone.pl.',
  robots: { index: false, follow: false },
};

const sections = [
  {
    title: '1. Postanowienia ogólne',
    note: 'Do uzupełnienia: definicje, przedmiot regulaminu, dane operatora serwisu.',
  },
  {
    title: '2. Zakres usług',
    note: 'Do uzupełnienia: opis funkcji serwisu (sprawdzanie ogłoszeń, dodawanie opinii).',
  },
  {
    title: '3. Obowiązki użytkownika',
    note: 'Do uzupełnienia: zasady dodawania opinii, zakaz treści bezprawnych.',
  },
  {
    title: '4. Odpowiedzialność',
    note: 'Do uzupełnienia: zakres odpowiedzialności serwisu za treści użytkowników i dane z ogłoszeń.',
  },
  {
    title: '5. Reklamacje i kontakt',
    note: 'Do uzupełnienia: tryb składania reklamacji.',
  },
];

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Regulamin serwisu</h1>
        <p className="text-gray-600 mb-8">
          Ta strona jest szkieletem regulaminu i wymaga uzupełnienia o docelowe zapisy prawne przed publikacją.
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
