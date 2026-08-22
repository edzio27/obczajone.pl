import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://obczajone.pl';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/posrednicy`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/partnerzy`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  try {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, last_checked_at, is_active')
      .eq('is_active', true)
      .order('last_checked_at', { ascending: false })
      .limit(1000);

    const listingPages: MetadataRoute.Sitemap = (listings || []).map((listing) => ({
      url: `${baseUrl}/listing/${listing.id}`,
      lastModified: new Date(listing.last_checked_at),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    return [...staticPages, ...listingPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return staticPages;
  }
}
