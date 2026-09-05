import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Strict allowlist of hostnames we are willing to fetch server-side.
// Listings can be created anonymously with an arbitrary `url` value, so this
// job must not blindly fetch whatever is stored in the DB (SSRF risk).
const ALLOWED_HOSTNAMES: Record<'otomoto' | 'otodom', string[]> = {
  otomoto: ['www.otomoto.pl', 'otomoto.pl'],
  otodom: ['www.otodom.pl', 'otodom.pl'],
};

function isAllowedUrl(rawUrl: string, source: 'otomoto' | 'otodom'): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '169.254.169.254' ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    return false;
  }

  return ALLOWED_HOSTNAMES[source].includes(hostname);
}

/*
  `gone` znaczy: serwis powiedzial wprost, ze tej oferty juz nie ma. Otomoto
  oddaje na zdjete ogloszenia HTTP 410 (sprawdzone na trzech wygaszonych
  adresach), co jest sygnalem mocniejszym niz brak ceny - ta moze zniknac takze
  przez chwilowa usterke albo zmiane ukladu strony.
*/
type ScrapeResult = {
  price: number | null;
  specs: Record<string, unknown> | null;
  gone?: boolean;
};

/** 410 Gone i 404 to odpowiedzi o trwale usunietym zasobie, nie o awarii. */
function isGoneStatus(status: number): boolean {
  return status === 410 || status === 404;
}

/**
 * Ile ogłoszeń przerabiamy w jednym przebiegu.
 *
 * Ograniczają nas dwa limity naraz. Funkcja brzegowa jest ubijana po ok. 150
 * sekundach, a pg_net - który wywołuje ją z crona - zrywa połączenie po czasie
 * podanym w `timeout_milliseconds`. Przy 2 sekundach przerwy między zapytaniami
 * i ok. 1,5 s na pobranie strony, 25 ogłoszeń to jakieś 85 sekund, czyli z
 * zapasem pod oba limity.
 *
 * Wcześniej było 50 przy domyślnym limicie pg_net wynoszącym 5 sekund: cron
 * meldował sukces, bo zapytanie SQL się wykonało, ale odpowiedź nigdy nie
 * wracała i przebieg był ucinany po dwóch ogłoszeniach.
 */
const BATCH_SIZE = 25;

/*
  Po tylu dniach bez ani jednej udanej ceny - przy trwajacych probach - uznajemy
  oferte za zdjeta. Tydzien, bo Otomoto miewa krotkie przerwy w oddawaniu stron,
  a ogloszenie zyje tam zwykle 30-60 dni: siedem dni ciszy to juz nie usterka.
*/
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// Te same klucze co extractOtomotoSpecs w funkcji scrape-listing - łącznie
// z polami odcisku palca egzemplarza (generacja, pojemność, moc, skrzynia,
// nadwozie, kolor, liczba drzwi).
//
// Dochodzą tu z tego samego powodu, dla którego w ogóle czytamy parametry
// w dziennym przebiegu: ogłoszenia dodane wcześniej nie dostaną ich w żaden
// inny sposób. Przy 1700 ogłoszeniach w bazie to jedyna droga, żeby te dane
// kiedykolwiek były komplete.
function extractOtomotoParam(ad: any, keys: string[]): string | null {
  const params = ad?.parameters ?? ad?.details ?? [];
  if (!Array.isArray(params)) return null;
  for (const key of keys) {
    const found = params.find((p: any) => p?.key === key || p?.name === key);
    if (found) return found.value ?? found.displayValue ?? found.normalizedValue ?? null;
  }
  return null;
}

function extractOtomotoSpecs(ad: any): Record<string, unknown> {
  return {
    brand: extractOtomotoParam(ad, ['make', 'brand']),
    model: extractOtomotoParam(ad, ['model']),
    year: extractOtomotoParam(ad, ['year']),
    mileage: extractOtomotoParam(ad, ['mileage']),
    fuel_type: extractOtomotoParam(ad, ['fuel_type', 'fuel']),
    generation: extractOtomotoParam(ad, ['generation']),
    engine_capacity: extractOtomotoParam(ad, ['engine_capacity']),
    engine_power: extractOtomotoParam(ad, ['engine_power']),
    gearbox: extractOtomotoParam(ad, ['gearbox']),
    body_type: extractOtomotoParam(ad, ['body_type']),
    color: extractOtomotoParam(ad, ['color']),
    door_count: extractOtomotoParam(ad, ['door_count']),
  };
}

async function scrapeOtomoto(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (isGoneStatus(response.status)) return { price: null, specs: null, gone: true };

    const html = await response.text();

    let price = 0;
    // Ten sam obiekt __NEXT_DATA__ niesie parametry auta, wiec pobieramy je przy
    // okazji sprawdzania ceny - ogloszenia dodane przed wprowadzeniem kolumny
    // specs inaczej nigdy ich nie dostana, a bez marki i modelu nie wchodza do
    // porownan cenowych.
    let specs: Record<string, unknown> | null = null;

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const ad = nextData?.props?.pageProps?.advert;
        if (ad?.price?.amount?.units) {
          price = parseInt(ad.price.amount.units);
        }
        if (ad) {
          const extracted = extractOtomotoSpecs(ad);
          if (extracted.brand && extracted.model) {
            specs = extracted;
          }
        }
      } catch (e) {
        console.error('Error parsing __NEXT_DATA__:', e);
      }
    }

    if (!price) {
      const dataMatch = html.match(/"rawPrice":"(\d+(?:\.\d+)?)"/);
      if (dataMatch) {
        price = parseInt(parseFloat(dataMatch[1]).toFixed(0));
      }
    }

    return { price, specs };
  } catch (error) {
    console.error('Error scraping Otomoto:', error);
    return { price: null, specs: null };
  }
}

async function scrapeOtodom(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (isGoneStatus(response.status)) return { price: null, specs: null, gone: true };

    const html = await response.text();

    let price = 0;

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const ad = nextData?.props?.pageProps?.ad;
        if (ad?.target?.Price) {
          price = parseInt(ad.target.Price);
        }
      } catch (e) {
        console.error('Error parsing NEXT_DATA:', e);
      }
    }

    if (!price) {
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.offers) {
            price = parseInt(jsonData.offers.price || jsonData.offers.priceSpecification?.price || 0);
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      }
    }

    return { price, specs: null };
  } catch (error) {
    console.error('Error scraping Otodom:', error);
    return { price: null, specs: null };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, url, source, current_price, specs')
      /*
        Wygaszonych nie odpytujemy. Do tej pory `is_active` nie znaczylo nic -
        zadne miejsce w kodzie go nie ustawialo i zadne po nim nie filtrowalo -
        wiec oferty zdjete z Otomoto krazyly w kolejce w nieskonczonosc, zjadajac
        miejsca w partii ogloszeniom, ktore jeszcze zyja.
      */
      .eq('is_active', true)
      // Najdawniej sprawdzane najpierw - dzięki temu kolejne przebiegi
      // przesuwają się po całej bazie zamiast krążyć wokół najnowszych.
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (listingsError) {
      throw new Error(`Failed to fetch listings: ${listingsError.message}`);
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let backfilledSpecs = 0;
    let deactivated = 0;

    for (const listing of listings || []) {
      try {
        let scraped: ScrapeResult = { price: null, specs: null };

        if (
          (listing.source === 'otomoto' || listing.source === 'otodom') &&
          !isAllowedUrl(listing.url, listing.source)
        ) {
          results.push({
            id: listing.id,
            success: false,
            error: 'Listing URL is not from a trusted host',
          });
          failCount++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        if (listing.source === 'otomoto') {
          scraped = await scrapeOtomoto(listing.url);
        } else if (listing.source === 'otodom') {
          scraped = await scrapeOtodom(listing.url);
        }

        const newPrice = scraped.price;

        // Uzupelniamy parametry tylko wtedy, gdy ich brakuje. Nadpisywanie
        // istniejacych groziloby wyczyszczeniem dobrych danych przy jednym
        // nieudanym odczycie strony.
        //
        // Brakujaca generacja liczy sie tak samo jak brakujaca marka - inaczej
        // 829 ogloszen, ktore maja juz marke i model, nie dostaloby nowych pol
        // nigdy, a to wlasnie one sa najstarsze. Scalamy zamiast podmieniac,
        // wiec dopisanie nowego pola nie moze skasowac tego, co juz jest.
        const specsMissing =
          !listing.specs?.brand || !listing.specs?.model || !listing.specs?.generation;
        if (scraped.specs && specsMissing) {
          const merged = { ...(listing.specs ?? {}), ...scraped.specs };
          await supabase.from('listings').update({ specs: merged }).eq('id', listing.id);
          backfilledSpecs++;
        }

        // last_checked_at przesuwamy przy KAZDEJ probie, takze nieudanej.
        //
        // Wczesniej znacznik szedl do przodu wylacznie wtedy, gdy zmienila sie
        // cena - czyli prawie nigdy. A poniewaz kolejke sortujemy wlasnie po tym
        // polu, sweep wybieral co godzine te same rekordy i nigdy nie docieral
        // dalej: 66 snapshotow na dobe rozlozylo sie na 20 ogloszen. Najstarsze
        // wpisy to zwykle oferty juz zdjete z serwisu, wiec kolejka zablokowala
        // sie na ogloszeniach, ktorych nie da sie pobrac.
        //
        // Znacznik znaczy teraz "kiedy probowalismy", a nie "kiedy drgnela cena".
        await supabase
          .from('listings')
          .update({
            ...(newPrice && newPrice > 0 ? { current_price: newPrice } : {}),
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', listing.id);

        if (newPrice && newPrice > 0) {
          await supabase.from('listing_snapshots').insert({
            listing_id: listing.id,
            price: newPrice,
          });

          results.push({
            id: listing.id,
            success: true,
            price: newPrice,
            changed: newPrice !== listing.current_price,
          });
          successCount++;
        } else {
          /*
            Nieudany odczyt sam w sobie nic nie przesadza - Otomoto potrafi
            chwilowo nie oddac strony. Ale jesli od ostatniej UDANEJ ceny minelo
            ponad tyle dni, a my w tym czasie probowalismy, to nie jest usterka
            sieci, tylko oferta zdjeta z serwisu.

            Dowod mamy juz w danych i nie kosztuje ani jednego zapytania do
            Otomoto: `last_checked_at` przesuwa sie po KAZDEJ probie, a snapshot
            powstaje wylacznie po udanej. Rozjazd miedzy nimi to wlasnie licznik
            nieudanych prob.
          */
          const { data: lastSnapshot } = await supabase
            .from('listing_snapshots')
            .select('scraped_at')
            .eq('listing_id', listing.id)
            .order('scraped_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastSuccess = lastSnapshot?.scraped_at
            ? new Date(lastSnapshot.scraped_at).getTime()
            : null;
          const staleFor = lastSuccess == null ? null : Date.now() - lastSuccess;

          /*
            Dwie drogi do wygaszenia, bo dwa rozne dowody.

            `gone` to odpowiedz wprost od serwisu (HTTP 410) - czekanie tygodnia
            niczego by tu nie dodalo. Domyka tez luke w regule czasowej:
            ogloszenie, ktore NIGDY nie dalo sie odczytac, nie ma od czego
            liczyc siedmiu dni i bez tego zostaloby aktywne na zawsze.

            Reguła czasowa obsluguje reszte - awarie ciche, gdzie strona wraca,
            ale ceny w niej nie ma.
          */
          if (scraped.gone || (staleFor != null && staleFor > STALE_AFTER_MS)) {
            await supabase
              .from('listings')
              .update({ is_active: false })
              .eq('id', listing.id);
            deactivated++;
          }

          results.push({
            id: listing.id,
            success: false,
            error: scraped.gone ? 'Advert removed (HTTP 410)' : 'Failed to scrape price',
          });
          failCount++;
        }
      } catch (error) {
        console.error(`Error processing listing ${listing.id}:`, error);
        results.push({
          id: listing.id,
          success: false,
          error: error.message,
        });
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: listings?.length || 0,
        successCount,
        failCount,
        backfilledSpecs,
        deactivated,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // Log full details server-side only; never leak stack traces or internal
    // error details to the client (information disclosure).
    console.error('Error in daily-price-scraper function:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to run price scraper',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
