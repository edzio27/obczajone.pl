import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ListingUrlForm } from '@/components/listing-url-form';
import { RecentListings } from '@/components/recent-listings';
import { RecentReviews } from '@/components/recent-reviews';
import { PromotionalBanner } from '@/components/promotional-banner';
import { HowItWorks } from '@/components/home/how-it-works';
import { WhyUs } from '@/components/home/why-us';
import { Faq } from '@/components/home/faq';
import { ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              Sprawdź ogłoszenie przed zakupem
            </h1>

            <div className="flex justify-center mb-4">
              <ListingUrlForm />
            </div>

            <div className="flex justify-center mt-6">
              <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <ShieldCheck className="w-4 h-4 text-verified" />
                Ponad 10 000 sprawdzonych ogłoszeń
              </div>
            </div>

            <div className="mb-8 mt-16">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-left">Zobacz co inni znaleźli:</h3>
              <RecentReviews limit={10} showMoreButton={true} />
            </div>
          </div>

          <HowItWorks />
          <WhyUs />

          <div className="mt-20">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-left">
                Wszystkie sprawdzone ogłoszenia
              </h2>
              <p className="text-gray-600 text-left">
                Zobacz co inni użytkownicy weryfikowali
              </p>
            </div>
            <RecentListings limit={50} />
          </div>

          <div className="mt-20">
            <PromotionalBanner />
          </div>

          <Faq />

          <div className="mt-20 bg-primary rounded-3xl p-10 md:p-12 text-center text-white shadow-xl">
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-verified" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Gotowy na bezpieczne zakupy?
            </h2>
            <p className="text-lg text-white/80 mb-6 max-w-2xl mx-auto">
              Dołącz do tysięcy użytkowników, którzy chronią się przed oszustwami korzystając z obczajone.pl
            </p>
            <div className="flex justify-center">
              <ListingUrlForm />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
