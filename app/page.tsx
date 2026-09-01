import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ListingUrlForm } from '@/components/listing-url-form';
import { MobileActionBar } from '@/components/mobile-action-bar';
import { RecentListings } from '@/components/recent-listings';
import { RecentReviews } from '@/components/recent-reviews';
import { PartnersSection } from '@/components/promotional-banner';
import { Hero } from '@/components/home/hero';
import { SectionHeading } from '@/components/home/section-heading';
import { InspectionCta } from '@/components/home/inspection-cta';
import { HowItWorks } from '@/components/home/how-it-works';
import { WhyUs } from '@/components/home/why-us';
import { BiggestPriceDrops } from '@/components/biggest-price-drops';
import { RecentlyInspected } from '@/components/recently-inspected';
import { DealerMapTeaser } from '@/components/dealer-map-teaser';
import { Faq, faqs } from '@/components/home/faq';
import { Reveal } from '@/components/motion/reveal';
import { Eye, Search } from 'lucide-react';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { fetchPartners } from '@/lib/partner-data';
import {
  fetchBiggestPriceDrops,
  fetchDealerMapCounts,
  fetchHomeStats,
  fetchRecentListings,
  fetchRecentlyInspected,
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
      stats,
      recentListings,
      recentlyReviewed,
      priceDrops,
      recentlyInspected,
      dealerMapCounts,
      partners,
    ] = await Promise.all([
      fetchHomeStats(supabase),
      fetchRecentListings(supabase, { pageSize: RECENT_LISTINGS_PAGE_SIZE }),
      fetchRecentlyReviewedListings(supabase, 10),
      fetchBiggestPriceDrops(supabase),
      fetchRecentlyInspected(supabase),
      fetchDealerMapCounts(supabase),
      fetchPartners(supabase),
    ]);

    return {
      stats,
      recentListings,
      recentlyReviewed,
      priceDrops,
      recentlyInspected,
      dealerMapCounts,
      partners,
    };
  } catch (error) {
    console.error('Nie udalo sie pobrac danych strony glownej:', error);
    return {
      stats: {
        listingCount: null,
        reviewCount: null,
        inspectionCount: null,
        partnerCount: null,
      },
      recentListings: [],
      recentlyReviewed: [],
      priceDrops: [],
      recentlyInspected: [],
      dealerMapCounts: { sellerCount: null, reviewCount: null },
      partners: [],
    };
  }
}

export default async function Home() {
  const {
    stats,
    recentListings,
    recentlyReviewed,
    priceDrops,
    recentlyInspected,
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

      <Hero stats={stats} />

      <main className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          {/*
            Dowody przed tłumaczeniem. "Jak to działa" i "Dlaczego warto" stały
            wyżej niż cokolwiek, co serwis faktycznie zrobił - czyli odwiedzający
            czytał dwie sekcje o nas, zanim zobaczył choć jedno sprawdzone
            ogłoszenie. Objaśnienia zeszły niżej, do FAQ, gdzie szuka ich ten,
            komu wciąż czegoś brakuje.
          */}
          <section className="pt-4" aria-labelledby="ostatnio-sprawdzone">
            <SectionHeading
              id="ostatnio-sprawdzone"
              eyebrow="Świeżo sprawdzone"
              icon={Eye}
              title="Zobacz, co znaleźli inni"
              description="Oferty, przy których ktoś już zostawił opinię albo wyłapał zmianę ceny."
            />
            <RecentReviews listings={recentlyReviewed} showMoreButton={true} />
          </section>

          <RecentlyInspected listings={recentlyInspected} />

          {/* Argument komercyjny stoi dopiero tutaj - po tym, jak czytelnik
              zobaczył, że serwis coś realnie sprawdził, a nie przed. */}
          <InspectionCta partners={partners} />

          <BiggestPriceDrops listings={priceDrops} />

          <Reveal className="mt-20 block">
            <DealerMapTeaser
              sellerCount={dealerMapCounts.sellerCount}
              reviewCount={dealerMapCounts.reviewCount}
            />
          </Reveal>

          <PartnersSection partners={partners} />

          <section className="mt-20" aria-labelledby="wszystkie-ogloszenia">
            <SectionHeading
              id="wszystkie-ogloszenia"
              eyebrow="Baza ofert"
              icon={Search}
              title="Wszystkie sprawdzone ogłoszenia"
              description="Każda oferta, którą ktokolwiek tu wkleił — z historią ceny i opiniami."
            />
            <RecentListings
              pageSize={RECENT_LISTINGS_PAGE_SIZE}
              initialListings={recentListings}
            />
          </section>

          <HowItWorks />
          <WhyUs />
          <Faq />

          <Reveal>
            <section className="surface-ink relative isolate mt-20 overflow-hidden rounded-[1.75rem] px-6 py-12 text-center md:px-12 md:py-16">
              <div aria-hidden className="absolute inset-0 mesh-ink" />
              <div aria-hidden className="absolute inset-0 grid-lines opacity-60" />

              <div className="relative">
                <h2 className="mx-auto max-w-2xl text-3xl md:text-[2.6rem] leading-[1.08] font-extrabold text-white text-balance">
                  Masz link do oferty? Sprawdź go, zanim wpłacisz zaliczkę.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[15px] md:text-base text-white/65 text-pretty">
                  Historia ceny, opinie i analiza ogłoszenia — w kilka sekund, bez konta
                  i bez opłat.
                </p>
                <div className="mt-8 flex justify-center">
                  <ListingUrlForm tone="ink" />
                </div>
              </div>
            </section>
          </Reveal>
        </div>
      </main>

      <Footer />
      <MobileActionBar />
    </div>
  );
}
