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
    {
      url: `${baseUrl}/dla-firm`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    // Nieudany scrape zostawia wiersz z pustym tytułem i ceną 0. Interfejs takie
    // ogłoszenia ukrywa (listy filtrują po current_price > 0), więc sitemapa nie
    // może ich zgłaszać - inaczej karmimy Google stronami, które sami uznaliśmy
    // za zbyt zepsute, żeby je pokazać.
    const { data: listings } = await supabase
      .from('listings')
      .select('id, last_checked_at, is_active, title')
      .eq('is_active', true)
      .gt('current_price', 0)
      .neq('title', '')
      .order('last_checked_at', { ascending: false })
      // Limit sitemapy to 50 000 URL-i, a nie 1000. Przy 1572 kwalifikujących
      // się ogłoszeniach stary próg wycinał 572 strony - ponad jedną trzecią
      // całej powierzchni, z której ma przychodzić ruch z wyszukiwarki.
      .limit(5000);

    const listingPages: MetadataRoute.Sitemap = (listings || []).map((listing) => ({
      url: `${baseUrl}/listing/${listing.id}`,
      lastModified: new Date(listing.last_checked_at),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    // Profile partnerów to strony, które sprzedajemy firmom jako realną wartość -
    // muszą być w sitemapie, inaczej obietnica "własnej podstrony w Google" jest
    // pusta.
    const { data: partners } = await supabase
      .from('partners')
      .select('slug')
      .eq('is_active', true);

    const partnerPages: MetadataRoute.Sitemap = (partners || []).map((partner) => ({
      url: `${baseUrl}/partner/${partner.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...staticPages, ...listingPages, ...partnerPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return staticPages;
  }
}
