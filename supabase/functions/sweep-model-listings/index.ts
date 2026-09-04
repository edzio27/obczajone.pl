import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/*
  Przelot po modelach - druga noga zbierania danych, obok daily-price-scraper.

  Dotad ogloszenie trafialo do bazy wylacznie wtedy, gdy ktos wklecil link, co
  dawalo okolo jednego dziennie. Przy takim doplywie statystyki obnizek nie maja
  z czego powstac: zeby zobaczyc, ze sprzedajacy zszedl z ceny, trzeba obserwowac
  ofertę tygodniami, a wiekszosc ofert znika z Otomoto po 30-60 dniach. Stad
  odwrocenie kierunku - zamiast czekac na uzytkownika, sami obchodzimy rynek.

  Jedna strona wynikow oddaje 32 oferty razem z cena i parametrami, wiec nie
  wchodzimy na strony pojedynczych ogloszen. To jest tez powod, dla ktorego
  przelot w ogole ma sens kosztowo: 45 zapytan zamiast 1400.

  Co robimy w ktorej kolejnosci, mowi tabela model_sweep_targets - 15 modeli po
  3 strony. Kolejnosc bierze sie stamtad, a nie ze stalej listy w kodzie, bo
  jeden przebieg miesci okolo 23 pozycji i lista zaczynana od poczatku nigdy nie
  dowiozlaby koncowki.

  Czego nie robimy: robots.txt Otomoto zabrania /api/, /ajax/ i /i2/, wiec
  czytamy wylacznie publiczna strone wynikow, ktora jest tam objeta "Allow: /".
  Nie kopiujemy opisow ani zdjec - bierzemy cene, parametry i adres, czyli to,
  z czego liczymy wlasne statystyki i co i tak odsylamy linkiem do zrodla.
*/

/*
  Funkcja brzegowa jest ubijana po ok. 150 sekundach, a wywolujacy ja pg_net
  zrywa polaczenie jeszcze wczesniej. Konczymy sami z zapasem; pozycje, ktorych
  nie zdazylismy tknac, zostaja na czele kolejki i bierze je nastepny przebieg.
*/
const TIME_BUDGET_MS = 110_000;

/** Odstęp między zapytaniami do Otomoto. */
const REQUEST_DELAY_MS = 2000;

/*
  Przedstawiamy sie zamiast udawac przegladarke. Otomoto oddaje strone tak samo
  (sprawdzone), a jesli kiedykolwiek uznaja ten ruch za niepozadany, chcemy zeby
  mieli po czym nas rozpoznac i jak sie odezwac.
*/
const USER_AGENT = 'obczajone.pl model sweep (+https://obczajone.pl)';

type SweepTarget = { id: string; path: string; page: number };

type Advert = {
  listingId: string;
  url: string;
  title: string;
  price: number;
  location: string;
  imageUrl: string | null;
  specs: Record<string, unknown>;
  /*
    Obnizka wedlug samego Otomoto. Dane kontrolne: nie publikujemy ich i nie
    licza sie do zadnej mediany - maja sluzyc porownaniu, gdy uzbieramy dosc
    wlasnych obserwacji, zeby bylo co porownywac.
  */
  sourceDropPercent: number | null;
  sourcePriceBefore: number | null;
};

/*
  Otomoto nazywa cene odniesienia `lowestPrice`, choc jest ona WYZSZA od ceny
  biezacej - to cena sprzed obnizki. Sprawdzone na zywej ofercie: 184 900 zl
  przy `lowestPrice` 187 900 zl i `percentage` 1.6, co zgadza sie tylko jako
  (187900 - 184900) / 187900. `minorAmount` jest w groszach.
*/
function extractSourceDrop(priceDrop: any): {
  percent: number | null;
  priceBefore: number | null;
} {
  if (!priceDrop) return { percent: null, priceBefore: null };

  const percent = Number(priceDrop.percentage);
  const minor = Number(priceDrop?.lowestPrice?.minorAmount);

  return {
    percent: Number.isFinite(percent) ? percent : null,
    priceBefore: Number.isFinite(minor) ? minor / 100 : null,
  };
}

/** Adres bez zapytania - identyfikuje ofertę i tylko tyle chcemy trzymać. */
function canonicalUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return raw;
  }
}

function listingIdFromUrl(url: string): string | null {
  const match = url.split('?')[0].match(/-ID([A-Za-z0-9]+)\.html/);
  return match ? match[1] : null;
}

/*
  Parametry oferty przychodza jako lista {key, displayValue}. Bierzemy
  displayValue, bo to ono niesie nazwe w formie, w jakiej juz stoi w bazie
  ("BMW", "Seria 3", "Benzyna") - `value` jest slugiem i rozjechaloby sie
  z danymi zebranymi ze stron pojedynczych ogloszen.
*/
function specsFromParameters(parameters: any[]): Record<string, unknown> {
  const byKey = new Map<string, string>();
  for (const p of parameters || []) {
    if (p?.key && typeof p.displayValue === 'string') byKey.set(p.key, p.displayValue);
  }

  return {
    brand: byKey.get('make') ?? null,
    model: byKey.get('model') ?? null,
    year: byKey.get('year') ?? null,
    mileage: byKey.get('mileage') ?? null,
    fuel_type: byKey.get('fuel_type') ?? null,
    gearbox: byKey.get('gearbox') ?? null,
    engine_capacity: byKey.get('engine_capacity') ?? null,
    engine_power: byKey.get('engine_power') ?? null,
  };
}

/**
 * Oferty z jednej strony wyników.
 *
 * Dane siedzą w __NEXT_DATA__, w cache'u urql pod kluczem, który zmienia się
 * między wdrożeniami Otomoto - dlatego zamiast trafiać w konkretny klucz
 * przechodzimy wpisy i bierzemy ten, który zawiera `advertSearch`.
 */
async function fetchModelPage(path: string, page: number): Promise<Advert[]> {
  // Strona pierwsza bez parametru - to ten sam adres, który widzi człowiek.
  const url =
    page > 1
      ? `https://www.otomoto.pl/osobowe/${path}?page=${page}`
      : `https://www.otomoto.pl/osobowe/${path}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('Brak __NEXT_DATA__ na stronie wyników');

  const urqlState = JSON.parse(match[1])?.props?.pageProps?.urqlState ?? {};

  let edges: any[] | null = null;
  for (const entry of Object.values(urqlState) as any[]) {
    if (typeof entry?.data !== 'string') continue;
    try {
      const parsed = JSON.parse(entry.data);
      if (parsed?.advertSearch?.edges) {
        edges = parsed.advertSearch.edges;
        break;
      }
    } catch {
      // Nie każdy wpis cache'u jest wynikiem wyszukiwania - pomijamy.
    }
  }

  if (!edges) throw new Error('Nie znaleziono advertSearch w cache urql');

  const adverts: Advert[] = [];
  for (const edge of edges) {
    const node = edge?.node;
    if (!node?.url) continue;

    const listingId = listingIdFromUrl(node.url);
    const price = Number(node?.price?.amount?.units ?? 0);
    if (!listingId || !(price > 0)) continue;

    const sourceDrop = extractSourceDrop(node.priceDrop);

    adverts.push({
      listingId,
      url: canonicalUrl(node.url),
      title: typeof node.title === 'string' ? node.title : '',
      price,
      location: node?.location?.city?.name ?? '',
      imageUrl: typeof node?.thumbnail?.x1 === 'string' ? node.thumbnail.x1 : null,
      specs: specsFromParameters(node.parameters),
      sourceDropPercent: sourceDrop.percent,
      sourcePriceBefore: sourceDrop.priceBefore,
    });
  }

  return adverts;
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

    /*
      Kolejność bierze się z last_swept_at rosnąco, z nietkniętymi na przedzie.
      Dzięki temu kolejne przebiegi przesuwają się po całej liście, zamiast
      krążyć wokół jej początku - przy stałej liście w kodzie ostatnie modele
      nie doczekałyby się nigdy, a każdy przebieg i tak meldowałby sukces.
    */
    const { data: targets, error: targetsError } = await supabase
      .from('model_sweep_targets')
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
        const adverts = await fetchModelPage(path, page);

        const { data: existingRows } = await supabase
          .from('listings')
          .select('id, listing_id, current_price')
          .in(
            'listing_id',
            adverts.map((a) => a.listingId)
          );

        const existing = new Map(
          (existingRows || []).map((r: any) => [r.listing_id, r])
        );

        const fresh = adverts.filter((a) => !existing.has(a.listingId));

        /*
          Wiersz zakladamy w dwoch krokach, bo trg_reset_listing_scraper_fields
          czysci tytul, cene, zdjecie i lokalizacje przy KAZDYM INSERT - broni
          tabeli przed klientem, ktory chcialby je sobie ustawic. Wstawiamy wiec
          szkielet, a pola scrapera dopisujemy UPDATE-em, dokladnie tak, jak robi
          to sciezka pojedynczego ogloszenia.
        */
        if (fresh.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('listings')
            .insert(
              fresh.map((a) => ({
                listing_id: a.listingId,
                source: 'otomoto',
                url: a.url,
                created_by: null,
              }))
            )
            .select('id, listing_id');

          if (insertError) throw new Error(`insert: ${insertError.message}`);

          for (const row of inserted || []) {
            const advert = fresh.find((a) => a.listingId === row.listing_id);
            if (!advert) continue;

            await supabase
              .from('listings')
              .update({
                title: advert.title,
                location: advert.location,
                current_price: advert.price,
                image_url: advert.imageUrl,
                specs: advert.specs,
                last_checked_at: new Date().toISOString(),
              })
              .eq('id', row.id);

            existing.set(row.listing_id, { id: row.id, current_price: advert.price });
            added++;
          }
        }

        // Znane ogłoszenia: cena i znacznik próby, bez ruszania parametrów.
        for (const advert of adverts) {
          const row: any = existing.get(advert.listingId);
          if (!row || fresh.some((f) => f.listingId === advert.listingId)) continue;

          await supabase
            .from('listings')
            .update({
              current_price: advert.price,
              last_checked_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          updated++;
        }

        /*
          Snapshot dla kazdej oferty z tej strony, takze gdy cena sie nie zmienila
          - to z ciagu takich zapisow bierze sie pozniej "pierwsza obserwowana
          cena", a wiec i cala statystyka obnizek.
        */
        const snapshotRows = adverts
          .map((a) => {
            const row: any = existing.get(a.listingId);
            return row
              ? {
                  listing_id: row.id,
                  price: a.price,
                  source_drop_percent: a.sourceDropPercent,
                  source_price_before: a.sourcePriceBefore,
                }
              : null;
          })
          .filter(Boolean);

        if (snapshotRows.length > 0) {
          const { error: snapshotError } = await supabase
            .from('listing_snapshots')
            .insert(snapshotRows as any[]);
          if (snapshotError) throw new Error(`snapshots: ${snapshotError.message}`);
          snapshots += snapshotRows.length;
        }

        outcome = `${adverts.length} ofert, ${fresh.length} nowych`;
        results.push({ model: path, page, found: adverts.length, added: fresh.length });
      } catch (error) {
        outcome = (error as Error).message.slice(0, 200);
        results.push({ model: path, page, error: outcome });
      }

      /*
        Znacznik przesuwamy po KAŻDEJ próbie, także nieudanej. Gdyby przesuwał
        się tylko po sukcesie, jedna trwale niedziałająca pozycja blokowałaby
        czoło kolejki i reszta nie doczekałaby się nigdy.
      */
      await supabase
        .from('model_sweep_targets')
        .update({ last_swept_at: new Date().toISOString(), last_result: outcome })
        .eq('id', target.id);

      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }

    return new Response(
      JSON.stringify({
        success: true,
        models: results.length,
        added,
        updated,
        snapshots,
        // Pozycje, na które nie starczyło czasu - wezmie je kolejny przebieg.
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
