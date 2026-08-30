import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ListingUrlForm } from '@/components/listing-url-form';
import { RecentListings } from '@/components/recent-listings';
import { RecentReviews } from '@/components/recent-reviews';
import { PartnersSection } from '@/components/promotional-banner';
import { HowItWorks } from '@/components/home/how-it-works';
import { WhyUs } from '@/components/home/why-us';
import { BiggestPriceDrops } from '@/components/biggest-price-drops';
import { RecentlyChecked } from '@/components/recently-checked';
import { DealerMapTeaser } from '@/components/dealer-map-teaser';
import { Faq, faqs } from '@/components/home/faq';
import { ShieldCheck, Search } from 'lucide-react';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { fetchPartners } from '@/lib/partner-data';
import {
  fetchBiggestPriceDrops,
  fetchDealerMapCounts,
  fetchRecentListings,
  fetchRecentlyChecked,
  fetchRecentlyReviewedListings,
} from '@/lib/home-data';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

// Odswiezamy raz na godzine - licznik nie musi byc co do sekundy aktualny,
// a strona zostaje w cache zamiast renderowac sie przy kazdym wejsciu.
export const revalidate = 3600;

// Pokazujemy prawdziwa liczbe sprawdzonych ogloszen zamiast zahardkodowanej.
// Ponizej progu chowamy plakietke - mala liczba dziala gorzej niz jej brak.
const LISTING_COUNT_BADGE_THRESHOLD = 100;

const RECENT_LISTINGS_PAGE_SIZE = 9;

/**
 * Wszystkie sekcje strony glownej pobieramy serwerowo i rownolegle. Wczesniej
 * kazda z nich odpytywala baze dopiero w przegladarce, przez co w HTML-u nie
 * bylo ani jednego linku do ogloszenia - a to jedyne wewnetrzne linkowanie,
 * jakie prowadzi do stron ogloszen.
 */
async function getHomeData() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [
      countResult,
      recentListings,
      recentlyReviewed,
      priceDrops,
      recentlyChecked,
      dealerMapCounts,
      partners,
    ] = await Promise.all([
      supabase.from('listings').select('id', { count: 'exact', head: true }),
      fetchRecentListings(supabase, { pageSize: RECENT_LISTINGS_PAGE_SIZE }),
      fetchRecentlyReviewedListings(supabase, 10),
      fetchBiggestPriceDrops(supabase),
      fetchRecentlyChecked(supabase),
      fetchDealerMapCounts(supabase),
      fetchPartners(supabase),
    ]);

    return {
      listingCount: countResult.count ?? null,
      recentListings,
      recentlyReviewed,
      priceDrops,
      recentlyChecked,
      dealerMapCounts,
      partners,
    };
  } catch (error) {
    console.error('Nie udalo sie pobrac danych strony glownej:', error);
    return {
      listingCount: null,
      recentListings: [],
      recentlyReviewed: [],
      priceDrops: [],
      recentlyChecked: [],
      dealerMapCounts: { sellerCount: null, reviewCount: null },
      partners: [],
    };
  }
}

export default async function Home() {
  const {
    listingCount,
    recentListings,
    recentlyReviewed,
    priceDrops,
    recentlyChecked,
    dealerMapCounts,
    partners,
  } = await getHomeData();
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />

      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
              Sprawdź, zanim kupisz.
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-6">
              Sprawdź historię ceny, oceń wiarygodność ogłoszenia i zobacz, czy sprzedający już obniżał cenę.
            </p>

            <div className="flex justify-center mb-4">
              <ListingUrlForm />
            </div>

            {/*
              Druga droga obok wklejania linku. Wyszukiwarka obsługuje tylko tego,
              kto ma już konkretne ogłoszenie - a część odwiedzających szuka po
              prostu kogoś, kto pojedzie obejrzeć auto. Do wczoraj nie mieli na tej
              stronie żadnego wejścia w tę stronę.
            */}
            <div className="flex justify-center">
              <Link
                href="/partnerzy"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Szukasz kogoś, kto sprawdzi auto lub nieruchomość przed zakupem?
                <span className="font-medium text-primary underline underline-offset-2">
                  Znajdź partnera
                </span>
              </Link>
            </div>

            {listingCount !== null && listingCount >= LISTING_COUNT_BADGE_THRESHOLD && (
              <div className="flex justify-center mt-6">
                <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  {listingCount.toLocaleString('pl-PL')} sprawdzonych ogłoszeń
                </div>
              </div>
            )}

            <div className="mt-10">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-left">Zobacz co inni znaleźli:</h3>
              <RecentReviews listings={recentlyReviewed} showMoreButton={true} />
            </div>

            <div className="mb-8 mt-16">
              <DealerMapTeaser
                sellerCount={dealerMapCounts.sellerCount}
                reviewCount={dealerMapCounts.reviewCount}
              />
            </div>
          </div>

          <div className="mt-12">
            <PartnersSection partners={partners} />
          </div>

          {/*
            Dowody przed tłumaczeniem. "Jak to działa" i "Dlaczego warto" stały
            wyżej niż cokolwiek, co serwis faktycznie zrobił - czyli odwiedzający
            czytał dwie sekcje o nas, zanim zobaczył choć jedno sprawdzone
            ogłoszenie. Objaśnienia zeszły niżej, do FAQ, gdzie szuka ich ten,
            komu wciąż czegoś brakuje.
          */}
          <div className="mt-8">
            <BiggestPriceDrops listings={priceDrops} />
          </div>

          <div className="mt-8">
            <RecentlyChecked listings={recentlyChecked} />
          </div>

          <div className="mt-8">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-left flex items-center gap-2">
                <Search className="h-6 w-6 text-primary" />
                Wszystkie sprawdzone ogłoszenia
              </h2>
            </div>
            <RecentListings
              pageSize={RECENT_LISTINGS_PAGE_SIZE}
              initialListings={recentListings}
            />
          </div>

          <HowItWorks />
          <WhyUs />

          <Faq />

          <div className="mt-14 bg-primary rounded-3xl p-10 md:p-12 text-center text-white shadow-xl">
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-success" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Gotowy na bezpieczne zakupy?
            </h2>
            <p className="text-lg text-white/80 mb-6 max-w-2xl mx-auto">
              Wklej link do ogłoszenia z Otomoto lub Otodom i sprawdź, czy sprzedający już obniżał cenę.
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
