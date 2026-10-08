import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ListingUrlForm } from '@/components/listing-url-form';
import { MobileActionBar } from '@/components/mobile-action-bar';
import { ArchiveTeaser } from '@/components/archive-teaser';
import { trwaBudowanie } from '@/lib/retry';
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
import { fetchPartners } from '@/lib/partner-data';
import { fetchModelTrends } from '@/lib/price-trends';
import { klientSerwerowy } from '@/lib/supabase-server';
import {
  fetchBiggestPriceDrops,
  fetchDealerMapCounts,
  fetchHeroSpotlight,
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
    const supabase = klientSerwerowy();

    const [
      stats,
      spotlight,
      recentListings,
      recentlyReviewed,
      priceDrops,
      recentlyInspected,
      dealerMapCounts,
      partners,
      modelTrends,
    ] = await Promise.all([
      fetchHomeStats(supabase),
      fetchHeroSpotlight(supabase),
      fetchRecentListings(supabase, { pageSize: RECENT_LISTINGS_PAGE_SIZE }),
      fetchRecentlyReviewedListings(supabase, 10),
      fetchBiggestPriceDrops(supabase),
      fetchRecentlyInspected(supabase),
      fetchDealerMapCounts(supabase),
      fetchPartners(supabase),
      fetchModelTrends(supabase),
    ]);

    return {
      stats,
      spotlight,
      recentListings,
      recentlyReviewed,
      priceDrops,
      recentlyInspected,
      dealerMapCounts,
      partners,
      /*
        Sześć modeli o największej próbce - tyle mieści się w jednym rzędzie na
        telefonie i tyle wystarczy, żeby ktoś rozpoznał swój. Reszta jest pod
        "Wszystkie modele".
      */
      heroModels: modelTrends.slice(0, 6).map((t) => ({
        slug: t.slug,
        brand: t.brand,
        model: t.model,
        medianDropPercent: t.medianDropPercent,
      })),
    };
  } catch (error) {
    /*
      Puste dane nie mogą trafić do cache'u.

      Wcześniej ten catch oddawał komplet pustych wartości, a strona renderowała
      się "poprawnie" - bez ogłoszeń, bez liczb, bez niczego. Pod ISR Next
      zapisywał taki wynik jak każdy inny i serwował go przez godzinę, także po
      powrocie bazy. 26 września strona główna stała tak pusta, mimo że
      wszystkie dane były na miejscu.

      Wyjątek zatrzymuje regenerację: Next nie nadpisuje tego, co ma w cache'u,
      i dalej podaje ostatnią dobrą wersję. Człowiek widzi wtedy ogłoszenia
      sprzed godziny zamiast komunikatu, że serwis jest pusty.

      Ta sama decyzja co na stronie ogłoszenia, podjęta tam 21 września. Tutaj
      jej brakowało i dlatego awaria bazy zamieniła się w awarię treści.
    */
    console.error('Nie udalo sie pobrac danych strony glownej:', error);

    /*
      Przy budowaniu pustka jest do zniesienia, w czasie żądania nie.

      Wyjątek w czasie żądania chroni cache: Next zostawia ostatnią dobrą wersję
      zamiast zapisać pusty serwis. Ten sam wyjątek przy budowaniu przewraca
      deploy - a skoro API bywa niedostępne po kilka razy dziennie, oznaczało to,
      że w trakcie awarii nie dało się wdrożyć niczego, łącznie z jej naprawą.
      Zbudowana pustka żyje najwyżej do pierwszej rewalidacji.
    */
    if (!trwaBudowanie()) throw error;

    return {
      stats: {
        listingCount: null,
        reviewCount: null,
        inspectionCount: null,
        partnerCount: null,
        archivedCount: null,
      },
      spotlight: null,
      recentListings: [],
      recentlyReviewed: [],
      priceDrops: [],
      recentlyInspected: [],
      dealerMapCounts: { sellerCount: null, reviewCount: null },
      partners: [],
      heroModels: [],
    };
  }
}

export default async function Home() {
  const {
    stats,
    spotlight,
    recentListings,
    recentlyReviewed,
    priceDrops,
    recentlyInspected,
    dealerMapCounts,
    partners,
    heroModels,
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

      <Hero stats={stats} spotlight={spotlight} models={heroModels} />

      <main className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          {/*
            Dowody przed tłumaczeniem. "Jak to działa" i "Dlaczego warto" stały
            wyżej niż cokolwiek, co serwis faktycznie zrobił - czyli odwiedzający
            czytał dwie sekcje o nas, zanim zobaczył choć jedno sprawdzone
            ogłoszenie. Objaśnienia zeszły niżej, do FAQ, gdzie szuka ich ten,
            komu wciąż czegoś brakuje.
          */}
          {/*
            Na górze to, co się zmienia codziennie.

            Do 6 października pierwszą sekcją były opinie. Liczby pokazały, że
            to zły wybór: szesnaście zatwierdzonych opinii na dwunastu
            ogłoszeniach, najnowsza z 30 sierpnia - czyli odwiedzający od
            pięciu tygodni oglądał dokładnie to samo. W tym samym czasie
            scraper dołożył 1174 ogłoszenia w tydzień i zaobserwował zmiany
            cen na 1645. Pierwsze wrażenie brało się więc z najwolniej
            rosnącego zasobu, jaki mamy.

            Opinie nie znikają - schodzą niżej, gdzie są tym, czym są
            naprawdę: dowodem, że ktoś tam pojechał, a nie świeżością.
          */}
          <section className="pt-4" aria-labelledby="ostatnio-sprawdzone">
            <SectionHeading
              id="ostatnio-sprawdzone"
              eyebrow="Ostatnio sprawdzone"
              icon={Search}
              title="Co sprawdzano przed chwilą"
              description="Oferty wklejone i odświeżone najpóźniej — z historią ceny i opiniami."
            />
            <RecentListings
              pageSize={RECENT_LISTINGS_PAGE_SIZE}
              initialListings={recentListings}
            />
          </section>

          {/*
            Obniżki tuż za listą ostatnio sprawdzonych.

            To jedyna sekcja poza samą listą, która odświeża się codziennie -
            w tygodniu kończącym 6 października ceny ruszyły na 1645
            ogłoszeniach. Jest też najbliżej pytania, z którym ludzie tu
            przychodzą: nie "co ktoś o tym sądzi", tylko "ile da się utargować".
          */}
          <BiggestPriceDrops listings={priceDrops} />

          {/*
            Archiwum tuż za obniżkami: jedno i drugie opowiada o cenie w czasie,
            a czytelnik, który właśnie zobaczył, że sprzedający schodzą, jest
            najbliżej pytania "a za ile w końcu poszło to, co zniknęło".
          */}
          <Reveal className="mt-20 block">
            <ArchiveTeaser archivedCount={stats.archivedCount} />
          </Reveal>

          <Reveal className="mt-20 block">
            <DealerMapTeaser
              sellerCount={dealerMapCounts.sellerCount}
              reviewCount={dealerMapCounts.reviewCount}
            />
          </Reveal>

          {/*
            Werdykty i opinie stoją razem i niżej.

            Obie sekcje mówią to samo - ktoś pojechał i obejrzał - i obie rosną
            najwolniej w całym serwisie: dziesięć oględzin, najnowsza z 2
            września, i szesnaście opinii, najnowsza z 30 sierpnia. Jako
            pierwsze wrażenie dawały obraz serwisu, który stanął; tutaj robią
            to, do czego się nadają, czyli pokazują, że za liczbami stoi
            czyjaś wizyta na miejscu.
          */}
          <RecentlyInspected listings={recentlyInspected} />

          <section className="mt-20" aria-labelledby="co-znalezli-inni">
            <SectionHeading
              id="co-znalezli-inni"
              eyebrow="Oględziny na żywo"
              icon={Eye}
              title="Zobacz, co znaleźli inni"
              description="Oferty, przy których ktoś już zostawił opinię po obejrzeniu na miejscu."
            />
            <RecentReviews listings={recentlyReviewed} showMoreButton={true} />
          </section>

          {/* Argument komercyjny stoi dopiero tutaj - po tym, jak czytelnik
              zobaczył, że serwis coś realnie sprawdził, a nie przed. */}
          <InspectionCta partners={partners} />

          <PartnersSection partners={partners} />

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
