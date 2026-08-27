import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { safeJsonLdString } from '@/lib/json-ld';
import {
  fetchPartnerBySlug,
  fetchPartnerInspections,
  fetchPartnerReviews,
  reviewCountLabel,
  type Partner,
  type PartnerInspection,
  type PartnerReview,
} from '@/lib/partner-data';
import { PartnerClient } from './partner-client';

type Props = {
  params: { slug: string };
};

export const revalidate = 600;

type PartnerPageData = {
  partner: Partner;
  reviews: PartnerReview[];
  inspections: PartnerInspection[];
};

const getPartnerPageData = cache(async (slug: string): Promise<PartnerPageData | null> => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const partner = await fetchPartnerBySlug(supabase, slug);
  if (!partner) return null;

  const [reviews, inspections] = await Promise.all([
    fetchPartnerReviews(supabase, partner.id),
    fetchPartnerInspections(supabase, partner.id, { limit: 12 }),
  ]);

  return { partner, reviews, inspections };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPartnerPageData(params.slug);

  if (!data) {
    return {
      title: 'Partner nie znaleziony | obczajone.pl',
      description: 'Ten profil partnera nie istnieje w serwisie obczajone.pl',
      robots: { index: false, follow: true },
    };
  }

  const { partner } = data;
  const what =
    partner.category === 'car' ? 'sprawdzanie samochodów przed zakupem' : 'sprawdzanie nieruchomości przed zakupem';
  const where = partner.city ? ` — ${partner.city}` : '';

  const title = `${partner.name}${where} — opinie i kontakt | obczajone.pl`;
  const description =
    partner.rating_count > 0
      ? `${partner.name}: ${what}${where}. Ocena ${partner.rating_avg?.toFixed(1)}/5 na podstawie ${reviewCountLabel(partner.rating_count)}. Zamów oględziny przez obczajone.pl.`
      : `${partner.name}: ${what}${where}. ${partner.description} Zamów oględziny i wystaw opinię na obczajone.pl.`;

  const pageUrl = `https://obczajone.pl/partner/${partner.slug}`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: 'profile',
      siteName: 'obczajone.pl',
      locale: 'pl_PL',
    },
  };
}

export default async function PartnerPage({ params }: Props) {
  const data = await getPartnerPageData(params.slug);

  if (!data) {
    notFound();
  }

  const jsonLd = buildPartnerJsonLd(data);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }}
      />
      <PartnerClient
        partner={data.partner}
        initialReviews={data.reviews}
        inspections={data.inspections}
      />
    </>
  );
}

/**
 * LocalBusiness zamiast Organization: partnerzy to firmy usługowe działające w
 * konkretnym mieście, a to właśnie ten typ Google pokazuje w wynikach lokalnych
 * razem z oceną. Dla partnera ta podstrona jest realnym powodem, żeby u nas być.
 */
function buildPartnerJsonLd({ partner, reviews }: PartnerPageData) {
  const pageUrl = `https://obczajone.pl/partner/${partner.slug}`;

  const business: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: partner.name,
    description: partner.about || partner.description,
    url: pageUrl,
    image: partner.logo_url ? `https://obczajone.pl${partner.logo_url}` : undefined,
    telephone: partner.phone || undefined,
    email: partner.email || undefined,
    sameAs: [partner.website, partner.contact_url].filter(Boolean),
    areaServed: partner.voivodeship || partner.city || undefined,
  };

  if (partner.city) {
    business.address = {
      '@type': 'PostalAddress',
      addressLocality: partner.city,
      addressRegion: partner.voivodeship || undefined,
      addressCountry: 'PL',
    };
  }

  if (partner.lat != null && partner.lng != null) {
    business.geo = {
      '@type': 'GeoCoordinates',
      latitude: partner.lat,
      longitude: partner.lng,
    };
  }

  if (partner.rating_count > 0 && partner.rating_avg != null) {
    business.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(partner.rating_avg.toFixed(1)),
      reviewCount: partner.rating_count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviews.length > 0) {
    business.review = reviews.slice(0, 10).map((review) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: {
        '@type': 'Person',
        name: review.author?.display_name || 'Użytkownik obczajone.pl',
      },
      datePublished: review.created_at,
      reviewBody: review.comment || undefined,
    }));
  }

  return business;
}
