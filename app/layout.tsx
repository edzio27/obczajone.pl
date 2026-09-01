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
  title: 'obczajone.pl - Historia Cen i Opinie o Ogłoszeniach Otomoto i Otodom',
  description: 'Sprawdź historię zmian cen, czytaj opinie użytkowników i weryfikuj ogłoszenia z Otomoto i Otodom. Chroń się przed oszustwami i nieuczciwymi sprzedawcami. Darmowa baza opinii o ogłoszeniach.',
  keywords: ['otomoto opinie', 'otodom opinie', 'historia cen otomoto', 'historia cen otodom', 'weryfikacja ogłoszeń', 'opinie o sprzedawcach', 'sprawdź ogłoszenie', 'oszustwa otomoto', 'oszustwa otodom', 'bezpieczne zakupy', 'opinie kupujących'],
  authors: [{ name: 'obczajone.pl' }],
  creator: 'obczajone.pl',
  publisher: 'obczajone.pl',

  manifest: '/manifest.json',

  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: 'https://obczajone.pl',
    title: 'obczajone.pl - Sprawdź Historię i Opinie Przed Zakupem',
    description: 'Weryfikuj ogłoszenia z Otomoto i Otodom. Czytaj opinie użytkowników, sprawdzaj historię cen i chroń się przed oszustwami.',
    siteName: 'obczajone.pl',
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'obczajone.pl - Historia Cen i Opinie o Ogłoszeniach',
    description: 'Sprawdź historię cen i opinie o ogłoszeniach z Otomoto i Otodom. Chroń się przed oszustwami.',
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
