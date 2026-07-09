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
    .select('rating')
    .eq('listing_id', id);

  const reviewCount = reviews?.length || 0;
  const averageRating = reviewCount > 0
    ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : null;

  return { listing, snapshot, reviewCount, averageRating };
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

export default function ListingPage({ params }: Props) {
  return <ListingClient listingId={params.id} />;
}
