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

type ScrapeResult = { price: number | null; specs: Record<string, unknown> | null };

// Te same klucze co extractOtomotoSpecs w funkcji scrape-listing.
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
  };
}

async function scrapeOtomoto(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
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
      .order('created_at', { ascending: false });

    if (listingsError) {
      throw new Error(`Failed to fetch listings: ${listingsError.message}`);
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let backfilledSpecs = 0;

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
        const specsMissing = !listing.specs?.brand || !listing.specs?.model;
        if (scraped.specs && specsMissing) {
          await supabase.from('listings').update({ specs: scraped.specs }).eq('id', listing.id);
          backfilledSpecs++;
        }

        if (newPrice && newPrice > 0) {
          if (newPrice !== listing.current_price) {
            await supabase
              .from('listings')
              .update({
                current_price: newPrice,
                last_checked_at: new Date().toISOString(),
              })
              .eq('id', listing.id);
          }

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
          results.push({
            id: listing.id,
            success: false,
            error: 'Failed to scrape price',
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
