import './globals.css';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { CookieConsent } from '@/components/cookie-consent';
import { ReferralTracker } from '@/components/referral-tracker';
// Analityka Vercela: bez ciasteczek i bez identyfikatora użytkownika, więc nie
// wymaga zgody z bannera - ale bez niej nie wiemy nawet, czy ktokolwiek wchodzi
// na strony ogłoszeń, a to jedyna liczba, od której zależy cała reszta.
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

// Jeden krój na nagłówki i logotyp zamiast dwóch osobnych (Manrope + Baloo).
// Zmienna oś wagi daje 600-800 w jednym pliku, więc mimo mocniejszej
// typografii przeglądarka pobiera o jeden font mniej niż wcześniej.
const display = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-display',
  // Ta wersja Nexta nie ma metryk Bricolage w tablicy zastępników i przy każdym
  // renderze wypisuje o tym ostrzeżenie. Wyłączamy automatyczny fallback -
  // w font-family i tak stoi za nim Inter, który ładuje się z tej samej strony.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://obczajone.pl'),
  // "Historia cen" zostaje na początku i zostaje dosłownie: to na niej strona
  // stoi na pozycji 1.1 przy CTR 47-60% i nie ma powodu tego ruszać. Zmienia się
  // druga połowa - "opinie" nie przyniosły w kwartale ani jednego zapytania
  // (133 frazy, zero o opiniach), a "archiwum" przyniosło 628 wyświetleń.
  title: 'obczajone.pl - Historia Cen i Archiwum Ogłoszeń Otomoto i Otodom',
  description: 'Sprawdź historię zmian cen ogłoszeń z Otomoto i Otodom, także tych już zdjętych. Archiwum ofert z zapisaną ceną, datą zniknięcia i historią obniżek.',
  keywords: ['historia cen otomoto', 'otomoto historia cen', 'archiwum otomoto', 'otomoto archiwum ogłoszeń', 'ogłoszenia archiwalne otomoto', 'historia ogłoszeń otomoto', 'jak sprawdzić historię ogłoszenia na otomoto', 'historia cen otodom', 'archiwalne ceny samochodów'],
  authors: [{ name: 'obczajone.pl' }],
  creator: 'obczajone.pl',
  publisher: 'obczajone.pl',

  manifest: '/manifest.json',

  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: 'https://obczajone.pl',
    title: 'obczajone.pl - Historia cen i archiwum ogłoszeń',
    description: 'Historia cen ogłoszeń z Otomoto i Otodom, łącznie z ofertami już zdjętymi. Sprawdź, ile kosztowało auto, zanim zniknęło.',
    siteName: 'obczajone.pl',
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'obczajone.pl - Historia cen i archiwum ogłoszeń',
    description: 'Historia cen ogłoszeń z Otomoto i Otodom, łącznie z tymi już zdjętymi.',
  },

  // Additional metadata
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Additional tags
  category: 'Technology',
  classification: 'Business',

  // App-specific
  applicationName: 'obczajone.pl',
  referrer: 'origin-when-cross-origin',

};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'obczajone.pl',
    description: 'Portal do sprawdzania historii cen i opinii o ogłoszeniach z Otomoto i Otodom',
    url: 'https://obczajone.pl',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://obczajone.pl/?url={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: 'obczajone.pl',
      url: 'https://obczajone.pl',
    },
  };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'obczajone.pl',
    url: 'https://obczajone.pl',
    logo: 'https://obczajone.pl/manifest-icon/512',
  };

  return (
    <html lang="pl">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${display.variable}`}>
        <AuthProvider>
          {children}
          <Toaster />
          <CookieConsent />
          <ReferralTracker />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
