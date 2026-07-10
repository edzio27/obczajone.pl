import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/toaster';

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://obczajone.pl'),
  title: 'obczajone.pl - Historia Cen i Opinie o Ogłoszeniach Otomoto i Otodom',
  description: 'Sprawdź historię zmian cen, czytaj opinie użytkowników i weryfikuj ogłoszenia z Otomoto i Otodom. Chroń się przed oszustwami i nieuczciwymi sprzedawcami. Darmowa baza opinii o ogłoszeniach.',
  keywords: ['otomoto opinie', 'otodom opinie', 'historia cen otomoto', 'historia cen otodom', 'weryfikacja ogłoszeń', 'opinie o sprzedawcach', 'sprawdź ogłoszenie', 'oszustwa otomoto', 'oszustwa otodom', 'bezpieczne zakupy', 'opinie kupujących'],
  authors: [{ name: 'obczajone.pl' }],
  creator: 'obczajone.pl',
  publisher: 'obczajone.pl',

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',

  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: 'https://obczajone.pl',
    title: 'obczajone.pl - Sprawdź Historię i Opinie Przed Zakupem',
    description: 'Weryfikuj ogłoszenia z Otomoto i Otodom. Czytaj opinie użytkowników, sprawdzaj historię cen i chroń się przed oszustwami.',
    siteName: 'obczajone.pl',
    images: [
      {
        url: 'https://obczajone.pl/og-image.png',
        width: 1200,
        height: 630,
        alt: 'obczajone.pl - Historia i opinie o ogłoszeniach',
      },
    ],
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'obczajone.pl - Historia Cen i Opinie o Ogłoszeniach',
    description: 'Sprawdź historię cen i opinie o ogłoszeniach z Otomoto i Otodom. Chroń się przed oszustwami.',
    images: ['https://obczajone.pl/og-image.png'],
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

  // Verification and analytics
  verification: {
    google: 'google-site-verification-code', // Dodaj swój kod weryfikacji Google
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

  return (
    <html lang="pl">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="canonical" href="https://obczajone.pl" />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
