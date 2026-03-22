import { Header } from '@/components/header';
import { ListingUrlForm } from '@/components/listing-url-form';
import { RecentListings } from '@/components/recent-listings';
import { Search, TrendingDown, Shield, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <Search className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Historia i opinie o ogłoszeniach
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Sprawdź historię cen, zmian w opisie i przeczytaj opinie osób, które obejrzały nieruchomość lub samochód
            </p>

            <div className="flex justify-center mb-12">
              <ListingUrlForm />
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-16">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                  <TrendingDown className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Historia cen
                </h3>
                <p className="text-gray-600 text-sm">
                  Śledź zmiany cen w czasie i wykrywaj podejrzane manipulacje
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Opinie kupujących
                </h3>
                <p className="text-gray-600 text-sm">
                  Przeczytaj doświadczenia osób, które już obejrzały ofertę
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg mb-4">
                  <Shield className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Bezpieczeństwo
                </h3>
                <p className="text-gray-600 text-sm">
                  Weryfikowane opinie i moderacja treści przez nasz zespół
                </p>
              </div>
            </div>
          </div>

          <div className="mt-20">
            <RecentListings />
          </div>
        </div>
      </main>

      <footer className="border-t bg-white mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p className="font-semibold text-gray-900 mb-1">obczajone.pl</p>
            <p>Historia i opinie o ogłoszeniach z Otomoto i Otodom</p>
            <p className="mt-2">Pomagamy kupującym podejmować świadome decyzje</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
