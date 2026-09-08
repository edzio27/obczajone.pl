import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/*
  Przelot po Otodomie - odpowiednik sweep-model-listings dla nieruchomosci.

  Strona mieszkaniowa rosla dotad wylacznie z wklejek: 52 aktywne oferty wobec
  ponad trzech tysiecy samochodowych, wiec kategoria `home` i pierwszy partner
  w niej nie mieli czego obslugiwac.

  Jednostka pracy jest miasto, a nie model - reszta konstrukcji jest taka sama
  jak przy Otomoto i celowo: kolejnosc z tabeli otodom_sweep_targets, znacznik
  przesuwany po kazdej probie, budzet czasu ponizej limitu funkcji brzegowej.

  Swiadomie jest to osobna funkcja i osobna tabela, mimo podobienstwa. Wspolna
  wersja wymagalaby przerobienia dzialajacego przelotu po modelach, ktory
  chodzi dwa razy dziennie i wlasnie zaczal przynosic pierwsze obnizki. Cena
  tej decyzji to dwa miejsca do poprawienia przy zmianie wspolnej zasady i tyle
  warto o niej wiedziec.

  Czego nie robimy: robots.txt Otodomu zabrania /ajax/ i /api/query, wiec
  czytamy wylacznie publiczna strone wynikow, objeta tam "Allow: /". Nie
  kopiujemy opisow ani zdjec - bierzemy cene, miasto, metraz i adres.
*/

const TIME_BUDGET_MS = 110_000;
const REQUEST_DELAY_MS = 2000;
const USER_AGENT = 'obczajone.pl listing sweep (+https://obczajone.pl)';

type SweepTarget = { id: string; path: string; page: number };

type Offer = {
  listingId: string;
  url: string;
  title: string;
  price: number;
  location: string;
  imageUrl: string | null;
  specs: Record<string, unknown>;
};

/*
  Otodom oddaje liczbe pokoi i pietro jako slowa ("THREE", "FIRST"), a reszta
  serwisu trzyma te pola jako tekst z cyfra - tak zapisuje je scrape-listing
  ze strony pojedynczej oferty. Bez przelozenia to samo mieszkanie mialoby
  "3" albo "THREE" w zaleznosci od tego, ktora droga trafilo do bazy.
*/
const ROOMS: Record<string, string> = {
  ONE: '1', TWO: '2', THREE: '3', FOUR: '4', FIVE: '5',
  SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9', TEN: '10',
};

const FLOORS: Record<string, string> = {
  GROUND: '0', FIRST: '1', SECOND: '2', THIRD: '3', FOURTH: '4', FIFTH: '5',
  SIXTH: '6', SEVENTH: '7', EIGHTH: '8', NINTH: '9', TENTH: '10',
};

/** Identyfikator oferty siedzi na koncu sluga: ...-ID4CZn0 */
function listingIdFromSlug(slug: string): string | null {
  const match = slug.match(/-ID([A-Za-z0-9]+)$/);
  return match ? match[1] : null;
}

/**
 * Oferty z jednej strony wyników.
 *
 * Dane leżą w __NEXT_DATA__ pod `data.searchAds.items`. Bierzemy tylko wpisy
 * `estate: 'FLAT'` — pozostałe to kafelki inwestycji deweloperskich, które nie
 * są jednym mieszkaniem i nie mają jednej ceny, więc w bazie ogłoszeń byłyby
 * czymś innym niż wszystko dookoła.
 */
async function fetchCityPage(path: string, page: number): Promise<Offer[]> {
  const base = `https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie/${path}`;
  const url = page > 1 ? `${base}?page=${page}` : base;

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('Brak __NEXT_DATA__ na stronie wyników');

  const items = JSON.parse(match[1])?.props?.pageProps?.data?.searchAds?.items;
  if (!Array.isArray(items)) throw new Error('Nie znaleziono searchAds.items');

  const offers: Offer[] = [];
  for (const item of items) {
    if (item?.estate !== 'FLAT') continue;

    const slug = typeof item.slug === 'string' ? item.slug : '';
    const listingId = listingIdFromSlug(slug);
    const price = Number(item?.totalPrice?.value ?? 0);
    if (!listingId || !(price > 0)) continue;

    const area = item?.areaInSquareMeters;

    offers.push({
      listingId,
      url: `https://www.otodom.pl/pl/oferta/${slug}`,
      title: typeof item.title === 'string' ? item.title : '',
      price,
      location: item?.location?.address?.city?.name ?? '',
      imageUrl: typeof item?.images?.[0]?.medium === 'string' ? item.images[0].medium : null,
      specs: {
        area: Number.isFinite(Number(area)) ? String(area) : null,
        rooms: ROOMS[item?.roomsNumber] ?? null,
        floor: FLOORS[item?.floorNumber] ?? null,
        // Rocznika budowy nie ma na liście wyników - tylko na stronie oferty.
        build_year: null,
      },
    });
  }

  return offers;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: targets, error: targetsError } = await supabase
      .from('otodom_sweep_targets')
      .select('id, path, page')
      .order('last_swept_at', { ascending: true, nullsFirst: true })
      .limit(40);

    if (targetsError) throw new Error(`targets: ${targetsError.message}`);

    const results: any[] = [];
    let added = 0;
    let updated = 0;
    let snapshots = 0;
    let remaining = 0;

    for (const target of (targets || []) as SweepTarget[]) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        remaining++;
        continue;
      }

      const { path, page } = target;
      let outcome = '';

      try {
        const offers = await fetchCityPage(path, page);

        const { data: existingRows } = await supabase
          .from('listings')
          .select('id, listing_id')
          .in('listing_id', offers.map((o) => o.listingId));

        const existing = new Map((existingRows || []).map((r: any) => [r.listing_id, r]));
        const fresh = offers.filter((o) => !existing.has(o.listingId));

        /*
          Wiersz zakladamy w dwoch krokach, bo trg_reset_listing_scraper_fields
          czysci tytul, cene, zdjecie i lokalizacje przy KAZDYM INSERT - broni
          tabeli przed klientem, ktory chcialby je sobie ustawic.
        */
        if (fresh.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('listings')
            .insert(fresh.map((o) => ({
              listing_id: o.listingId,
              source: 'otodom',
              url: o.url,
              created_by: null,
            })))
            .select('id, listing_id');

          if (insertError) throw new Error(`insert: ${insertError.message}`);

          for (const row of inserted || []) {
            const offer = fresh.find((o) => o.listingId === row.listing_id);
            if (!offer) continue;

            await supabase.from('listings').update({
              title: offer.title,
              location: offer.location,
              current_price: offer.price,
              image_url: offer.imageUrl,
              specs: offer.specs,
              last_checked_at: new Date().toISOString(),
            }).eq('id', row.id);

            existing.set(row.listing_id, { id: row.id });
            added++;
          }
        }

        for (const offer of offers) {
          const row: any = existing.get(offer.listingId);
          if (!row || fresh.some((f) => f.listingId === offer.listingId)) continue;

          await supabase.from('listings').update({
            current_price: offer.price,
            last_checked_at: new Date().toISOString(),
            // Widnieje na liscie wynikow, wiec zyje - patrz wygaszanie ofert.
            is_active: true,
          }).eq('id', row.id);
          updated++;
        }

        const snapshotRows = offers
          .map((o) => {
            const row: any = existing.get(o.listingId);
            return row ? { listing_id: row.id, price: o.price } : null;
          })
          .filter(Boolean);

        if (snapshotRows.length > 0) {
          const { error: snapshotError } = await supabase
            .from('listing_snapshots').insert(snapshotRows as any[]);
          if (snapshotError) throw new Error(`snapshots: ${snapshotError.message}`);
          snapshots += snapshotRows.length;
        }

        outcome = `${offers.length} ofert, ${fresh.length} nowych`;
        results.push({ city: path, page, found: offers.length, added: fresh.length });
      } catch (error) {
        outcome = (error as Error).message.slice(0, 200);
        results.push({ city: path, page, error: outcome });
      }

      // Znacznik przesuwamy po KAZDEJ probie, takze nieudanej - inaczej jedna
      // trwale zepsuta pozycja zablokowalaby czolo kolejki.
      await supabase
        .from('otodom_sweep_targets')
        .update({ last_swept_at: new Date().toISOString(), last_result: outcome })
        .eq('id', target.id);

      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }

    return new Response(
      JSON.stringify({
        success: true,
        targets: results.length,
        added,
        updated,
        snapshots,
        remaining,
        elapsedMs: Date.now() - startedAt,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
