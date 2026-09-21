import { createClient } from '@supabase/supabase-js';
import { fetchModelSlugs } from '@/lib/price-trends';
import { fetchCityPrices } from '@/lib/city-prices';

/*
  Sitemapa jako Route Handler, a nie metadata route (app/sitemap.ts).

  Powód jest pomiarowy, nie stylistyczny. W Next 13.5 `export const revalidate`
  w sitemap.ts nie jest honorowany: plik powstaje przy budowaniu i zostaje taki
  do następnego deployu. 15 września produkcja oddawała sitemapę z `age: 78051`,
  czyli sprzed 21 godzin, mimo ustawionego `revalidate = 3600` - a scraper
  dokłada w tym czasie kilkaset ogłoszeń, o których Google nie miał jak usłyszeć.

  Ograniczenie dotyczy jednak metadata route, nie route handlera: tutaj
  `revalidate` jest honorowany i po godzinie kolejne żądanie odświeża plik.
  `force-dynamic`, którym to wcześniej obeszliśmy, okazał się droższy, niż
  wyglądał - Next kasuje wtedy nasz `s-maxage=3600` i oddaje
  `cache-control: public, max-age=0`, więc świeżości pilnował nie nagłówek,
  tylko krótkotrwały cache Vercela, a każde jego wygaśnięcie to 13 kolejnych
  zapytań do bazy i zbudowanie 2,4 MB XML-a od nowa. Przy `revalidate` dzieje
  się to raz na godzinę i nie częściej - czyli dokładnie to, co ten komentarz
  obiecywał t4g.nano od początku.
*/
export const revalidate = 3600;

const BASE = 'https://obczajone.pl';

/*
  PostgREST tnie każdą odpowiedź do 1000 wierszy niezależnie od tego, o ile
  poprosimy, więc ogłoszenia chodzą stronami. Bez tej pętli sitemapa zgłaszała
  1000 z kilku tysięcy i o reszcie Google się nie dowiadywał.
*/
const PAGE = 1000;

type Entry = {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: number;
};

function xml(entries: Entry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastmod ? `\n<lastmod>${e.lastmod}</lastmod>` : '';
      return `<url>\n<loc>${e.loc}</loc>${lastmod}\n<changefreq>${e.changefreq}</changefreq>\n<priority>${e.priority}</priority>\n</url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function iso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const staticPages: Entry[] = [
  { loc: BASE, changefreq: 'daily', priority: 1 },
  { loc: `${BASE}/archiwum-otomoto`, changefreq: 'daily', priority: 0.9 },
  { loc: `${BASE}/barometr`, changefreq: 'daily', priority: 0.9 },
  { loc: `${BASE}/ceny-mieszkan`, changefreq: 'daily', priority: 0.9 },
  { loc: `${BASE}/ile-spada-cena`, changefreq: 'weekly', priority: 0.8 },
  { loc: `${BASE}/dla-mediow`, changefreq: 'weekly', priority: 0.7 },
  { loc: `${BASE}/obnizki`, changefreq: 'daily', priority: 0.8 },
  { loc: `${BASE}/posrednicy`, changefreq: 'weekly', priority: 0.8 },
  { loc: `${BASE}/werdykty`, changefreq: 'weekly', priority: 0.7 },
  { loc: `${BASE}/konkurs`, changefreq: 'daily', priority: 0.7 },
  { loc: `${BASE}/partnerzy`, changefreq: 'weekly', priority: 0.6 },
  { loc: `${BASE}/dla-firm`, changefreq: 'monthly', priority: 0.5 },
];

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const entries: Entry[] = [...staticPages];

  try {
    /*
      Ogłoszenia, i te wygaszone też.

      Wcześniej sitemapa filtrowała po `is_active`, więc zdjęte oferty z niej
      znikały - a to jest dokładnie ta treść, której ludzie szukają: trzy z pięciu
      najlepszych zapytań w Search Console to "archiwum otomoto", "historia
      ogłoszeń otomoto" i "otomoto historia cen". Zdjęte ogłoszenie z zapisaną
      historią cen jest jedyną stroną w sieci, która na nie odpowiada, bo Otomoto
      swoje po prostu kasuje.

      Nieudany scrape zostawia wiersz z pustym tytułem i ceną 0; interfejs takie
      ogłoszenia ukrywa, więc sitemapa też ich nie zgłasza - nie karmimy Google
      stronami, które sami uznaliśmy za zbyt zepsute, żeby je pokazać.
    */
    for (let from = 0; from < 50_000; from += PAGE) {
      const { data: batch } = await supabase
        .from('listings')
        .select('id, last_checked_at, is_active')
        .gt('current_price', 0)
        .neq('title', '')
        .order('last_checked_at', { ascending: false })
        .range(from, from + PAGE - 1);

      if (!batch || batch.length === 0) break;

      for (const listing of batch as { id: string; last_checked_at: string; is_active: boolean }[]) {
        entries.push({
          loc: `${BASE}/listing/${listing.id}`,
          lastmod: iso(listing.last_checked_at),
          // Wygaszone ogłoszenie już się nie zmieni - nie ma po co po nie wracać codziennie.
          changefreq: listing.is_active ? 'daily' : 'monthly',
          priority: listing.is_active ? 0.7 : 0.6,
        });
      }

      if (batch.length < PAGE) break;
    }

    // Miasta. Strony istnieją i odpowiadają 200 od dawna, ale nie było ich w
    // sitemapie, więc Google nie miał skąd o nich wiedzieć.
    const cities = await fetchCityPrices(supabase);
    for (const city of cities) {
      entries.push({
        loc: `${BASE}/ceny-mieszkan/${city.slug}`,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    // Statystyki spadków cen model po modelu: treść, której nie ma nikt inny.
    // Same slugi, bez liczenia median - liczenie kosztowało 29 z 34 sekund
    // generowania, czyli więcej niż Vercel daje funkcji na odpowiedź.
    const modelSlugs = await fetchModelSlugs(supabase);
    for (const slug of modelSlugs) {
      entries.push({
        loc: `${BASE}/ile-spada-cena/${slug}`,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    // Profile partnerów sprzedajemy firmom jako "własna podstrona w Google" -
    // bez nich w sitemapie ta obietnica jest pusta.
    const { data: partners } = await supabase
      .from('partners')
      .select('slug')
      .eq('is_active', true);

    for (const partner of (partners ?? []) as { slug: string }[]) {
      entries.push({
        loc: `${BASE}/partner/${partner.slug}`,
        changefreq: 'weekly',
        priority: 0.6,
      });
    }
  } catch (error) {
    console.error('Nie udało się zebrać adresów do sitemapy:', error);
    // Lepiej oddać same strony stałe niż 500 - Google ponowi za godzinę.
  }

  /*
    Sitemapa jest teraz plikiem ISR, więc to, co tu wyjdzie, Google dostaje
    przez następną godzinę. Nieudane zapytanie do bazy przy budowaniu dałoby
    więc plik z dwunastoma adresami zamiast dwunastu tysięcy - dla wyszukiwarki
    sygnał, że całe archiwum zniknęło. Przy dwóch ostatnich buildach Supabase
    rwał połączenia, więc to nie jest przypadek teoretyczny: lepiej wywalić
    build i powtórzyć go, niż opublikować sitemapę w tym stanie.
  */
  if (entries.length === staticPages.length) {
    throw new Error('Sitemapa bez ani jednego ogłoszenia - nie publikujemy jej w tym stanie.');
  }

  return new Response(xml(entries), {
    headers: {
      'content-type': 'application/xml',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
