import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { fetchModelTrends } from '@/lib/price-trends';

/*
  Bez tego sitemapa jest generowana raz, przy budowaniu, i zamarza. Scraper
  dokłada ogłoszenia codziennie, a Google dostawałoby listę z dnia ostatniego
  deployu - czyli nowe strony czekałyby na przypadkowy commit, żeby w ogóle
  zostać zgłoszone.
*/
export const revalidate = 3600;

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
    {
      url: `${baseUrl}/ile-spada-cena`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  try {
    // Nieudany scrape zostawia wiersz z pustym tytułem i ceną 0. Interfejs takie
    // ogłoszenia ukrywa (listy filtrują po current_price > 0), więc sitemapa nie
    // może ich zgłaszać - inaczej karmimy Google stronami, które sami uznaliśmy
    // za zbyt zepsute, żeby je pokazać.
    /*
      Pobieranie stronami, a nie jednym `limit`. PostgREST tnie każdą odpowiedź
      do 1000 wierszy niezależnie od tego, o ile poprosimy - podniesienie limitu
      nic nie daje, bo ograniczenie jest po stronie serwera. Bez tej pętli
      sitemapa zgłaszała 1000 z 1572 ogłoszeń i o pozostałych Google się nie
      dowiadywał.
    */
    const PAGE = 1000;
    const listings: { id: string; last_checked_at: string }[] = [];

    for (let from = 0; from < 50_000; from += PAGE) {
      const { data: batch } = await supabase
        .from('listings')
        .select('id, last_checked_at')
        .eq('is_active', true)
        .gt('current_price', 0)
        .neq('title', '')
        .order('last_checked_at', { ascending: false })
        .range(from, from + PAGE - 1);

      if (!batch || batch.length === 0) break;
      listings.push(...(batch as { id: string; last_checked_at: string }[]));
      if (batch.length < PAGE) break;
    }

    const listingPages: MetadataRoute.Sitemap = listings.map((listing) => ({
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

    // Strony ze statystykami spadków cen: jedyna treść w serwisie, której nie ma
    // nikt inny, więc bez nich sitemapa pomija to, po co Google miałoby tu
    // w ogóle przyjść.
    const trends = await fetchModelTrends(supabase);
    const trendPages: MetadataRoute.Sitemap = trends.map((trend) => ({
      url: `${baseUrl}/ile-spada-cena/${trend.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [...staticPages, ...listingPages, ...partnerPages, ...trendPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return staticPages;
  }
}
