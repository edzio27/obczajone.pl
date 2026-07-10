import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { ListingClient } from './listing-client';

type Props = {
  params: { id: string };
};

async function getListingData(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!listing) return null;

  const { data: snapshot } = await supabase
    .from('listing_snapshots')
    .select('photo_urls, title, description')
    .eq('listing_id', id)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, created_at')
    .eq('listing_id', id)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  const reviewCount = reviews?.length || 0;
  const averageRating = reviewCount > 0
    ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : null;

  return { listing, snapshot, reviewCount, averageRating, reviews: reviews || [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getListingData(params.id);

  if (!data) {
    return {
      title: 'Ogłoszenie nie znalezione | obczajone.pl',
      description: 'Ogłoszenie nie istnieje w bazie danych obczajone.pl',
    };
  }

  const { listing, snapshot, reviewCount, averageRating } = data;

  const title = `${listing.title} - ${listing.location} | obczajone.pl`;
  const description = averageRating
    ? `Sprawdź historię cen i ${reviewCount} opinii dla: ${listing.title}. Aktualna cena: ${listing.current_price.toLocaleString('pl-PL')} zł. Ocena: ${averageRating.toFixed(1)}/5.`
    : `Sprawdź historię cen dla: ${listing.title}. Aktualna cena: ${listing.current_price.toLocaleString('pl-PL')} zł. Bądź pierwszy który doda opinię!`;

  const imageUrl = snapshot?.photo_urls?.[0] || 'https://obczajone.pl/og-image.png';
  const pageUrl = `https://obczajone.pl/listing/${params.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: listing.title,
        },
      ],
      siteName: 'obczajone.pl',
      locale: 'pl_PL',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

// JSON.stringify does not escape "<", so a value like listing.title or
// review.comment (both attacker-controllable - listing.title has no RLS
// column-level restriction on insert, and review.comment is free user text)
// containing "</script><script>...</script>" would break out of this
// <script type="application/ld+json"> tag and execute as real markup/script
// when injected via dangerouslySetInnerHTML. Escaping "<" as the unicode
// escape neutralizes that while remaining valid, semantically identical JSON.
function safeJsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export default async function ListingPage({ params }: Props) {
  const data = await getListingData(params.id);
  const jsonLd = data ? buildListingJsonLd(params.id, data) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdString(jsonLd) }}
        />
      )}
      <ListingClient listingId={params.id} />
    </>
  );
}

function buildListingJsonLd(
  id: string,
  data: NonNullable<Awaited<ReturnType<typeof getListingData>>>
) {
  const { listing, snapshot, reviewCount, averageRating, reviews } = data;
  const pageUrl = `https://obczajone.pl/listing/${id}`;
  const imageUrl = snapshot?.photo_urls?.[0] || 'https://obczajone.pl/og-image.png';

  const product: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    url: pageUrl,
    image: imageUrl,
    offers: {
      '@type': 'Offer',
      url: listing.url,
      priceCurrency: 'PLN',
      price: listing.current_price,
      availability: listing.is_active
        ? 'https://schema.org/InStock'
        : 'https://schema.org/Discontinued',
    },
  };

  if (reviewCount > 0 && averageRating) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(averageRating.toFixed(1)),
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviews.length > 0) {
    product.review = reviews.slice(0, 10).map((review) => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: {
        '@type': 'Person',
        name: 'Użytkownik obczajone.pl',
      },
      datePublished: review.created_at,
      reviewBody: review.comment || undefined,
    }));
  }

  return product;
}
