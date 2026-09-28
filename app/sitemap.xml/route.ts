import { fetchModelSlugs } from '@/lib/price-trends';
import { fetchCityPrices } from '@/lib/city-prices';
import { trwaBudowanie } from '@/lib/retry';
import { klientSerwerowy } from '@/lib/supabase-server';

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
  const supabase = klientSerwerowy();

  const entries: Entry[] = [...staticPages];
  let listingCount = 0;

  try {
    /*
      Do sitemapy trafia to, co ma czytelnikowi coś do powiedzenia.

      Wybiera baza (`sitemap_listings`), nie ten kod. Pierwsze podejście
      pobierało wszystkie czternaście tysięcy ogłoszeń i odsiewało je tutaj -
      czyli dokładnie ten wzorzec, przez który 7 września skończył się budżet
      Disk IO, a 18 września przestał przechodzić build. Przy przeciążonej
      instancji nie dało się nawet wdrożyć naprawy obciążenia.

      Kryterium jest treściowe: strona ogłoszenia ma sens, gdy pokazuje coś,
      czego nie ma w samym ogłoszeniu - historię ceny albo to, że oferta
      zniknęła. Zostają więc wszystkie wygaszone (archiwum, po które ludzie tu
      przychodzą) i aktywne z realną zmianą ceny. Aktywna oferta stojąca od
      początku na tej samej cenie jest kopią treści z Otomoto; zostaje dostępna
      w serwisie, ale nie zgłaszamy jej do indeksowania.

          14 622 -> 3 504 adresy
    */
    /*
      Funkcja oddaje jedną tablicę jsonb, a nie wiersze.

      PostgREST tnie odpowiedź do 1000 wierszy także przy funkcjach: pierwsze
      wdrożenie dało sitemapę z 1064 adresami zamiast 3504 i zgubiło 2500
      ogłoszeń, w większości archiwalnych. Limit liczy wiersze, nie ich
      zawartość, więc jeden wiersz z tablicą przechodzi w całości.
    */
    /*
      Twardy limit czasu na zapytanie.

      supabase-js nie ma własnego timeoutu: gdy API nie odpowiada, zapytanie
      wisi, a nie zwraca błędu. Cała obsługa "gdy nie dostaliśmy ogłoszeń"
      poniżej nigdy się wtedy nie wykonywała - kod po prostu czekał, aż Next
      przerwie generowanie strony po sześćdziesięciu sekundach i uzna build za
      nieudany. Bez abortSignal żadne wyjście awaryjne nie ma szansy zadziałać.

      Przy budowaniu dziesięć sekund wystarcza z zapasem (zdrowe API odpowiada
      w sekundę), a w czasie żądania zostawiamy więcej miejsca, bo tam czeka
      człowiek, nie deploy.
    */
    const limitMs = trwaBudowanie() ? 10_000 : 45_000;

    const { data: listingJson, error: listingError } = await supabase
      .rpc('sitemap_listings')
      .abortSignal(AbortSignal.timeout(limitMs));

    if (listingError) {
      if (!trwaBudowanie()) {
        throw new Error(`Sitemapa nie dostała ogłoszeń: ${listingError.message}`);
      }

      /*
        Przy budowaniu wychodzimy od razu, bez próbowania reszty.

        Dalej czekają jeszcze zapytania o miasta, modele i partnerów. Gdy API
        nie odpowiada, każde z nich wisi do własnego timeoutu - cztery po sobie
        przekraczają sześćdziesiąt sekund, po których Next przerywa generowanie
        strony. Skoro pierwsze zapytanie już zawiodło, kolejne nie mają czego
        szukać; jedyne, co dołożą, to czas.

        Wychodzimy ze stronami stałymi i prośbą o odświeżenie po minucie.
      */
      console.warn('Sitemapa: API nie odpowiada przy budowaniu - wychodzę ze stronami stałymi');

      return new Response(xml(entries), {
        headers: {
          'content-type': 'application/xml',
          'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400',
        },
      });
    }

    type Row = { id: string; last_checked_at: string; is_active: boolean };

    for (const listing of ((listingJson ?? []) as Row[])) {
      entries.push({
        loc: `${BASE}/listing/${listing.id}`,
        lastmod: iso(listing.last_checked_at),
        // Wygaszone ogłoszenie już się nie zmieni - nie ma po co po nie wracać codziennie.
        changefreq: listing.is_active ? 'daily' : 'monthly',
        priority: listing.is_active ? 0.7 : 0.6,
      });
      listingCount += 1;
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
    /*
      Rzucamy dalej, a nie oddajemy same strony stałe - i to jest odwrócenie
      decyzji sprzed 15 września, bo zmieniło się to, co dzieje się z wynikiem.

      Przy trasie dynamicznej niepełna sitemapa żyła do następnego żądania i
      oddanie czegokolwiek było lepsze niż 500. Jako plik ISR ten sam wynik
      jedzie do Google na godzinę. Wyjątek oznacza, że przy budowaniu deploy
      pada i zostaje poprzedni, a przy odświeżaniu Next serwuje dalej ostatnią
      kompletną wersję. Obie te rzeczy są lepsze niż opublikowanie obciętej.
    */
    console.error('Nie udało się zebrać adresów do sitemapy:', error);
    throw error;
  }

  /*
    Sitemapa jest teraz plikiem ISR, więc to, co tu wyjdzie, Google dostaje
    przez następną godzinę. Nieudane zapytanie do bazy przy budowaniu dałoby
    więc plik z dwunastoma adresami zamiast dwunastu tysięcy - dla wyszukiwarki
    sygnał, że całe archiwum zniknęło. Przy dwóch ostatnich buildach Supabase
    rwał połączenia, więc to nie jest przypadek teoretyczny: lepiej wywalić
    build i powtórzyć go, niż opublikować sitemapę w tym stanie.
  */
  /*
    Zabezpieczenie zostaje, zmienia się tylko jego kształt.

    Dopóki ogłoszenia szły stronami, dało się urwać w połowie i trzeba było
    porównywać licznik z oczekiwaną liczbą. Teraz przychodzą jednym zapytaniem:
    albo mamy komplet, albo `sitemap_listings` zwróciło błąd i jesteśmy wyżej,
    w catch. Zostaje przypadek, którego to nie łapie - zapytanie udane, ale puste.
    Przy bazie z czternastoma tysiącami ogłoszeń zero oznacza awarię, nie prawdę
    o serwisie, a opublikowanie takiej mapy powiedziałoby Google, że całe
    archiwum zniknęło.
  */
  if (listingCount === 0) {
    /*
      W czasie żądania pusta mapa to awaria i nie wolno jej podać - Google
      odczytałby ją jako zniknięcie całego archiwum, a `stale-while-revalidate`
      i tak poda poprzednią, kompletną wersję.

      Przy budowaniu ten sam wyjątek przewracał deploy, a API Supabase bywa
      niedostępne po kilka razy dziennie - więc w trakcie awarii nie dało się
      wdrożyć niczego. Wychodzimy wtedy z samymi stronami stałymi, ale prosimy
      CDN o odświeżenie po minucie zamiast po godzinie: pierwsza regeneracja
      dołoży ogłoszenia, a okno, w którym mapa jest niepełna, liczy się
      w minutach zamiast w godzinach.
    */
    if (!trwaBudowanie()) {
      throw new Error('Sitemapa nie dostała ani jednego ogłoszenia - nie publikujemy jej w tym stanie.');
    }

    console.warn('Sitemapa budowana bez ogłoszeń - API niedostępne. Odświeży się za minutę.');

    return new Response(xml(entries), {
      headers: {
        'content-type': 'application/xml',
        'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400',
      },
    });
  }

  return new Response(xml(entries), {
    headers: {
      'content-type': 'application/xml',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
