import { Header } from '@/components/header';
import { ListingUrlForm } from '@/components/listing-url-form';
import { RecentListings } from '@/components/recent-listings';
import { RecentReviews } from '@/components/recent-reviews';
import { PromotionalBanner } from '@/components/promotional-banner';
import { TrendingDown, Shield, Users, Clock, Star, Search, CircleCheck as CheckCircle } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50/30">
      <Header />

      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-balance">
              Sprawdź ogłoszenie przed zakupem
            </h1>

            <div className="flex justify-center mb-4">
              <ListingUrlForm />
            </div>

            <div className="mb-8 mt-12">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-left">Zobacz co inni znaleźli:</h3>
              <RecentReviews limit={10} showMoreButton={true} />
            </div>

            <div className="mb-8">
              <PromotionalBanner />
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 mb-12">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <div className="relative">
                  <Search className="w-4 h-4 text-blue-500" />
                  <CheckCircle className="w-2 h-2 text-green-500 absolute -bottom-0.5 -right-0.5" />
                </div>
                <span>Drive Check</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>100% darmowe</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>Bezpieczne weryfikacje</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <Clock className="w-4 h-4 text-orange-500" />
                <span>Natychmiastowe wyniki</span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-12">
              <div className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-orange-200 transition-all duration-300 hover:-translate-y-1">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-400 to-green-500 rounded-xl mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-green-500/20">
                  <TrendingDown className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Historia cen
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Śledź zmiany cen w czasie i wykrywaj podejrzane manipulacje wartością oferty
                </p>
              </div>

              <div className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-orange-200 transition-all duration-300 hover:-translate-y-1">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Opinie kupujących
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Przeczytaj prawdziwe doświadczenia osób, które już obejrzały ofertę na żywo
                </p>
              </div>

              <div className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-orange-200 transition-all duration-300 hover:-translate-y-1">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-orange-500/20">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Bezpieczeństwo
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Weryfikowane opinie i moderacja treści przez nasz zespół ekspertów
                </p>
              </div>
            </div>
          </div>

          <div className="mt-20">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-left">
                Wszystkie sprawdzone ogłoszenia
              </h2>
              <p className="text-gray-600 text-left">
                Zobacz co inni użytkownicy weryfikowali
              </p>
            </div>
            <RecentListings limit={50} />
          </div>

          <div className="mt-20 bg-gradient-to-br from-orange-600 to-orange-700 rounded-3xl p-10 md:p-12 text-center text-white shadow-2xl shadow-orange-500/30">
            <Star className="w-12 h-12 mx-auto mb-4 text-yellow-300" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Gotowy na bezpieczne zakupy?
            </h2>
            <p className="text-lg text-orange-100 mb-6 max-w-2xl mx-auto">
              Dołącz do tysięcy użytkowników, którzy chronią się przed oszustwami korzystając z obczajone.pl
            </p>
            <div className="flex justify-center">
              <ListingUrlForm />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-gradient-to-b from-white to-gray-50 mt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div>
                <h3 className="font-bold text-gray-900 mb-4 text-lg">obczajone.pl</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Portal do weryfikacji ogłoszeń z Otomoto i Otodom.
                  Pomagamy kupującym podejmować świadome decyzje.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Dla użytkowników</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>Jak to działa?</li>
                  <li>Sprawdź ogłoszenie</li>
                  <li>Najczęstsze pytania</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Bezpieczeństwo</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>Polityka prywatności</li>
                  <li>Regulamin serwisu</li>
                  <li>Zgłoś nadużycie</li>
                </ul>
              </div>
            </div>

            <div className="border-t pt-8 text-center text-gray-600 text-sm">
              <p>&copy; 2024 obczajone.pl - Wszystkie prawa zastrzeżone</p>
              <p className="mt-2">Made with care for Polish buyers</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
