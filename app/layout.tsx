import './globals.css';
import type { Metadata } from 'next';
import { Baloo_2, Inter, Manrope } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { CookieConsent } from '@/components/cookie-consent';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
});
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  variable: '--font-manrope',
});
const baloo2 = Baloo_2({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800'],
  variable: '--font-logo',
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

  // Alternate languages
  alternates: {
    canonical: 'https://obczajone.pl',
    languages: {
      'pl': 'https://obczajone.pl',
    },
  },
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
        <link rel="canonical" href="https://obczajone.pl" />
      </head>
      <body className={`${inter.variable} ${manrope.variable} ${baloo2.variable}`}>
        <AuthProvider>
          {children}
          <Toaster />
          <CookieConsent />
        </AuthProvider>
      </body>
    </html>
  );
}
