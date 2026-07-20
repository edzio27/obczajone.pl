import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  listingId: string;
}

// Strict allowlist of hostnames we are willing to fetch server-side.
// Prevents SSRF via crafted/anonymous listing URLs or spoofed "source" values -
// a substring check like url.includes('otomoto') is NOT sufficient because an
// attacker can put that substring anywhere in the URL (path, query, fragment)
// while pointing the actual host at an internal/arbitrary target.
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

  // Block obvious internal/metadata/loopback targets even if hostname somehow
  // matched (defense in depth against DNS rebinding to the allowlisted host).
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

type ScrapedSeller = {
  externalId: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

// Only dealers ("PROFESSIONAL") get a seller profile. Confirmed via a real
// fetched Otomoto listing that this field exists with this exact value for
// a dealer account; the private-individual value hasn't been observed yet —
// if private listings start creating seller rows, check the real value here.
function extractSeller(ad: any): ScrapedSeller | null {
  if (ad?.seller?.type !== 'PROFESSIONAL') return null;
  if (!ad.seller.id || !ad.seller.name) return null;

  const cityRaw = ad.seller.location?.city;
  const city = typeof cityRaw === 'string' ? cityRaw : cityRaw?.name || '';

  const mapCoords = ad.seller.location?.map;
  const lat = typeof mapCoords?.latitude === 'number' ? mapCoords.latitude : null;
  const lng = typeof mapCoords?.longitude === 'number' ? mapCoords.longitude : null;

  return {
    externalId: String(ad.seller.id),
    name: ad.seller.name,
    city,
    address: ad.seller.location?.address || '',
    lat,
    lng,
  };
}

type OtomotoSpecs = {
  brand: string | null;
  model: string | null;
  year: string | null;
  mileage: string | null;
  fuel_type: string | null;
};

// Car parameters can appear under either `ad.parameters` or `ad.details`
// depending on the Otomoto page variant — check both. Each entry may key
// off `key` or `name`; confirmed against a real fetched listing (Task 2,
// Step 1) that the live shape is `ad.details` with entries keyed by `key`
// (e.g. {key: 'make', value: 'Volvo'}, {key: 'mileage', value: '85 597 km'}).
function extractOtomotoParam(ad: any, keys: string[]): string | null {
  const params = ad?.parameters ?? ad?.details ?? [];
  if (!Array.isArray(params)) return null;
  for (const key of keys) {
    const found = params.find((p: any) => p?.key === key || p?.name === key);
    if (found) return found.value ?? found.displayValue ?? found.normalizedValue ?? null;
  }
  return null;
}

function extractOtomotoSpecs(ad: any): OtomotoSpecs {
  return {
    brand: extractOtomotoParam(ad, ['make', 'brand']),
    model: extractOtomotoParam(ad, ['model']),
    year: extractOtomotoParam(ad, ['year']),
    mileage: extractOtomotoParam(ad, ['mileage']),
    fuel_type: extractOtomotoParam(ad, ['fuel_type', 'fuel']),
  };
}

async function scrapeOtomoto(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const html = await response.text();

    let title = '';
    let price = 0;
    let location = '';
    let photoUrl = '';
    let seller: ScrapedSeller | null = null;
    let description = '';
    let specs: OtomotoSpecs = { brand: null, model: null, year: null, mileage: null, fuel_type: null };
    let originalPostedAt: string | null = null;

    // Szukaj danych w __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps;
        const ad = pageProps?.advert;

        if (ad) {
          title = ad.title || '';

          if (ad.price?.amount?.units) {
            price = parseInt(ad.price.amount.units);
          }

          seller = extractSeller(ad);

          // `createdAt` is refreshed whenever the seller "bumps"/renews the
          // ad, so it does not reflect how long the car has actually been
          // listed. `originalCreatedAt` is the true first-publish date and
          // survives bumps; fall back to `createdAt` for the rare case it's
          // missing.
          originalPostedAt = ad.originalCreatedAt || ad.createdAt || null;

          if (ad.description) {
            description = String(ad.description).replace(/<[^>]*>/g, '').trim();
          }
          specs = extractOtomotoSpecs(ad);

          if (ad.seller?.location?.city) {
            location = typeof ad.seller.location.city === 'string'
              ? ad.seller.location.city
              : ad.seller.location.city.name;
          } else if (ad.seller?.location?.region) {
            location = typeof ad.seller.location.region === 'string'
              ? ad.seller.location.region
              : ad.seller.location.region.name;
          } else if (ad.location?.city) {
            location = typeof ad.location.city === 'string'
              ? ad.location.city
              : ad.location.city.name;
          } else if (ad.location?.region) {
            location = typeof ad.location.region === 'string'
              ? ad.location.region
              : ad.location.region.name;
          }

          if (ad.photos && Array.isArray(ad.photos) && ad.photos.length > 0) {
            photoUrl = ad.photos[0].large || ad.photos[0].medium || ad.photos[0].small || '';
          }
        }
      } catch (e) {
        console.error('Error parsing __NEXT_DATA__:', e);
      }
    }

    // Fallback - stare parsowanie
    if (!price) {
      const dataMatch = html.match(/"rawPrice":"(\d+(?:\.\d+)?)"/);
      if (dataMatch) {
        price = parseInt(parseFloat(dataMatch[1]).toFixed(0));
      }
    }

    if (!title) {
      const titleMatch = html.match(/"title":"([^"]+)","url"/) ||
                         html.match(/<h1[^>]*>(.*?)<\/h1>/s);
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      }
    }

    if (!location) {
      const locationMatch = html.match(/"addressLocality":"([^"]+)"/) ||
                            html.match(/"location":"([^"]+)"/);
      if (locationMatch) {
        location = locationMatch[1].trim();
      }
    }

    if (!photoUrl) {
      const photoMatch = html.match(/"(https:\/\/ireland\.apollo\.olxcdn\.com\/v1\/files\/[^"]+\/image)"/);
      if (photoMatch) {
        photoUrl = photoMatch[1].split(';')[0];
      }
    }

    return {
      title: title || 'Ogłoszenie Otomoto',
      price,
      location,
      photoUrl,
      seller,
      description,
      specs,
      originalPostedAt,
    };
  } catch (error) {
    console.error('Error scraping Otomoto:', error);
    return null;
  }
}

type OtodomSpecs = {
  area: string | null;
  rooms: string | null;
  floor: string | null;
  build_year: string | null;
};

// Otodom exposes property parameters on `ad.target` (PascalCase analytics
// fields) and separately in an `ad.characteristics` array (snake_case keys,
// e.g. {key: 'rooms_num', value: '4'}). Confirmed against two real fetched
// listings (Task 3, Step 1) - one secondary-market resale flat, one
// primary-market new-development flat:
//   - `target.Area` and `target.Build_year` are plain strings when present.
//   - `target.Rooms_num` and `target.Floor_no` are ARRAYS (e.g. ['4'],
//     ['floor_4']), not plain strings - unwrap the first element.
//   - `characteristics` uses key 'm' for area, NOT 'area'.
//   - `build_year` is only present (in both target and characteristics) for
//     primary-market listings; it's genuinely absent for resale listings, so
//     null is an expected, common result there - not a bug.
function unwrapTargetValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

function extractOtodomSpecs(ad: any): OtodomSpecs {
  const target = ad?.target ?? {};
  const characteristics = Array.isArray(ad?.characteristics) ? ad.characteristics : [];

  function fromCharacteristics(key: string): string | null {
    const found = characteristics.find((c: any) => c?.key === key);
    return found?.value ?? found?.localizedValue ?? null;
  }

  return {
    area: unwrapTargetValue(target.Area) ?? fromCharacteristics('m') ?? null,
    rooms: unwrapTargetValue(target.Rooms_num) ?? fromCharacteristics('rooms_num') ?? null,
    floor: unwrapTargetValue(target.Floor_no) ?? fromCharacteristics('floor_no') ?? null,
    build_year: unwrapTargetValue(target.Build_year) ?? fromCharacteristics('build_year') ?? null,
  };
}

async function scrapeOtodom(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const html = await response.text();

    let title = '';
    let price = 0;
    let location = '';
    let photoUrl = '';
    let description = '';
    let specs: OtodomSpecs = { area: null, rooms: null, floor: null, build_year: null };
    let originalPostedAt: string | null = null;

    // Szukaj danych w formacie __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const ad = nextData?.props?.pageProps?.ad;

        if (ad) {
          title = ad.title || '';

          if (ad.target?.Price) {
            price = parseInt(ad.target.Price);
          }

          if (ad.location?.address?.city?.name) {
            location = ad.location.address.city.name;
          } else if (ad.location?.reverseGeocoding?.locations?.[0]?.address?.city) {
            location = ad.location.reverseGeocoding.locations[0].address.city;
          }

          if (ad.images && Array.isArray(ad.images) && ad.images.length > 0) {
            photoUrl = ad.images[0].large || ad.images[0].medium || ad.images[0].small || '';
          }

          if (ad.description) {
            description = String(ad.description).replace(/<[^>]*>/g, '').trim();
          }
          specs = extractOtodomSpecs(ad);

          // Unlike Otomoto, Otodom's `createdAt` is not reset by bumps
          // (confirmed against a live listing: `pushedUpAt` was null and
          // `createdAt` predated `modifiedAt` by months) - it already is the
          // true original publish date.
          originalPostedAt = ad.createdAt || null;
        }
      } catch (e) {
        console.error('Error parsing NEXT_DATA:', e);
      }
    }

    // Fallback do JSON-LD
    if (!title || !price) {
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData['@type'] === 'Product' || jsonData['@type'] === 'RealEstateListing') {
            if (!title) title = jsonData.name || '';
            if (!price && jsonData.offers) {
              price = parseInt(jsonData.offers.price || jsonData.offers.priceSpecification?.price || 0);
            }
            if (!location && jsonData.address) {
              location = typeof jsonData.address === 'string' ? jsonData.address : jsonData.address.addressLocality || '';
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e);
        }
      }
    }

    return {
      title: title || 'Ogłoszenie Otodom',
      price,
      location,
      photoUrl,
      seller: null,
      description,
      specs,
      originalPostedAt,
    };
  } catch (error) {
    console.error('Error scraping Otodom:', error);
    return null;
  }
}

function normalizeSellerName(name: string, city: string): string {
  let normalized = name.trim().toLowerCase();
  const cityLower = city.trim().toLowerCase();
  if (cityLower && normalized.endsWith(cityLower)) {
    normalized = normalized.slice(0, normalized.length - cityLower.length).trim();
  }
  return normalized.replace(/\s+/g, ' ');
}

async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'obczajone.pl seller geocoder (https://obczajone.pl)' },
    });
    const results = await response.json();
    if (Array.isArray(results) && results.length > 0) {
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    }
    return null;
  } catch (error) {
    console.error('Error geocoding seller address:', error);
    return null;
  }
}

// Finds an existing sellers row for this (source, seller) pair, or creates one.
// Returns null only on an unexpected insert failure — callers must not treat
// null as "no seller" when `seller` was non-null going in.
async function resolveSellerId(
  supabase: ReturnType<typeof createClient>,
  source: 'otomoto' | 'otodom',
  seller: ScrapedSeller
): Promise<string | null> {
  const { data: byExternalId } = await supabase
    .from('sellers')
    .select('id')
    .eq('source', source)
    .eq('external_seller_id', seller.externalId)
    .eq('city', seller.city)
    .maybeSingle();

  if (byExternalId) return byExternalId.id;

  const normalizedName = normalizeSellerName(seller.name, seller.city);
  const { data: sameCitySellers } = await supabase
    .from('sellers')
    .select('id, name, city')
    .eq('source', source)
    .eq('city', seller.city);

  const nameMatch = sameCitySellers?.find(
    (candidate: { name: string; city: string }) =>
      normalizeSellerName(candidate.name, candidate.city) === normalizedName
  );

  if (nameMatch) return nameMatch.id;

  let lat = seller.lat;
  let lng = seller.lng;
  if (lat == null || lng == null) {
    const geocoded = await geocodeAddress(seller.address || seller.city);
    lat = geocoded?.lat ?? null;
    lng = geocoded?.lng ?? null;
  }

  const { data: newSeller, error: insertError } = await supabase
    .from('sellers')
    .insert({
      source,
      external_seller_id: seller.externalId,
      name: seller.name,
      city: seller.city,
      address: seller.address || null,
      lat,
      lng,
    })
    .select('id')
    .single();

  if (insertError) {
    // A concurrent scrape may have won the race and inserted the same
    // (source, external_seller_id, city) row first — re-fetch it instead
    // of treating this as a real failure.
    if (insertError.code === '23505') {
      const { data: raceWinner } = await supabase
        .from('sellers')
        .select('id')
        .eq('source', source)
        .eq('external_seller_id', seller.externalId)
        .eq('city', seller.city)
        .maybeSingle();
      return raceWinner?.id ?? null;
    }
    console.error('Error creating seller:', insertError);
    return null;
  }

  return newSeller?.id ?? null;
}

type AiOpinion = {
  rating: number;
  summary: string;
  priceNote: string;
  watchOutFor: string[];
  model: string;
};

const AI_OPINION_MODEL = 'claude-haiku-4-5';

const AI_OPINION_SCHEMA = {
  type: 'object',
  properties: {
    rating: { type: 'integer' },
    summary: { type: 'string' },
    price_note: { type: 'string' },
    watch_out_for: { type: 'array', items: { type: 'string' } },
  },
  required: ['rating', 'summary', 'price_note', 'watch_out_for'],
  additionalProperties: false,
};

type AiOpinionInput = {
  title: string;
  price: number;
  location: string;
  description: string;
  specs: Record<string, unknown>;
};

function buildAiOpinionPrompt(source: 'otomoto' | 'otodom', data: AiOpinionInput): string {
  const specsLines = Object.entries(data.specs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const kindLabel = source === 'otomoto' ? 'ogłoszenia samochodowego' : 'ogłoszenia nieruchomości';
  const sourceLabel = source === 'otomoto' ? 'Otomoto' : 'Otodom';

  return `Poniżej dane ${kindLabel} ze strony ${sourceLabel}:

Tytuł: ${data.title}
Cena: ${data.price} PLN
Lokalizacja: ${data.location}
Parametry:
${specsLines || '(brak dodatkowych parametrów)'}

Opis:
${data.description || '(brak opisu)'}

Napisz krótką, pierwszą opinię o tym ogłoszeniu po polsku, na podstawie wyłącznie powyższego opisu i parametrów (nie masz dostępu do zdjęć ani do innych ofert w bazie, więc oceniaj cenę w sposób przybliżony).

WAŻNE: nigdy nie formułuj stanowczych zarzutów wobec sprzedającego ani ogłoszenia. Punkty "na co zwrócić uwagę" pisz wyłącznie jako ostrożne pytania lub sugestie do zweryfikowania osobiście (np. "może warto dopytać o historię serwisową"), nigdy jako twierdzenia (np. nie pisz "przebieg wygląda podejrzanie").

Zwróć:
- rating: ocena 1-5 (liczba całkowita)
- summary: 2-3 zdania podsumowania
- price_note: jedno zdanie o cenie
- watch_out_for: lista 1-4 ostrożnych sugestii/pytań`;
}

// Requires the ANTHROPIC_API_KEY secret (`supabase secrets set ANTHROPIC_API_KEY=<key>`)
// and migration 20260717130000_add_ai_listing_opinion.sql applied to this project.
// Missing either causes this to no-op silently (by design — must never fail the scrape).
async function generateAiOpinion(
  source: 'otomoto' | 'otodom',
  data: AiOpinionInput
): Promise<AiOpinion | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set; skipping AI opinion generation');
    return null;
  }

  try {
    const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@0.71.0');
    const client = new Anthropic({ apiKey });

    // NOTE: verified against the actual @anthropic-ai/sdk@0.71.0 type
    // definitions (not the newer API docs) - in this SDK version,
    // structured-output parsing only exists on the beta namespace
    // (`client.beta.messages.parse`, not `client.messages.parse`), and the
    // JSON schema goes on a top-level `output_format` field, not nested
    // under `output_config` (which in 0.71.0 only supports `{ effort }`).
    // `client.beta.messages.parse` automatically adds the
    // `structured-outputs-2025-11-13` beta header internally.
    const response = await client.beta.messages.parse({
      model: AI_OPINION_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildAiOpinionPrompt(source, data) }],
      output_format: { type: 'json_schema', schema: AI_OPINION_SCHEMA },
    });

    const parsed = response.parsed_output as {
      rating: number;
      summary: string;
      price_note: string;
      watch_out_for: string[];
    } | null;

    if (!parsed) {
      console.error('AI opinion response did not parse against the schema');
      return null;
    }

    return {
      rating: Math.min(5, Math.max(1, Math.round(parsed.rating))),
      summary: parsed.summary,
      priceNote: parsed.price_note,
      watchOutFor: parsed.watch_out_for,
      model: AI_OPINION_MODEL,
    };
  } catch (error) {
    console.error('Error generating AI opinion:', error);
    return null;
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

    const body = await req.json();
    const { listingId }: RequestBody = body;

    if (!listingId || typeof listingId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid listingId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError || !listing) {
      throw new Error('Listing not found');
    }

    if (listing.source !== 'otomoto' && listing.source !== 'otodom') {
      throw new Error('Unsupported listing source');
    }

    if (!isAllowedUrl(listing.url, listing.source)) {
      // Do not attempt to fetch: the stored URL does not point at a trusted
      // host for its declared source. This blocks SSRF via listings inserted
      // (anonymously or otherwise) with an arbitrary url value.
      throw new Error('Listing URL is not from a trusted host');
    }

    let scrapedData;
    if (listing.source === 'otomoto') {
      scrapedData = await scrapeOtomoto(listing.url);
    } else {
      scrapedData = await scrapeOtodom(listing.url);
    }

    if (!scrapedData) {
      throw new Error('Failed to scrape listing');
    }

    let sellerId: string | null = null;
    if (scrapedData.seller) {
      sellerId = await resolveSellerId(supabase, listing.source, scrapedData.seller);
    }

    // Only set seller_id when this scrape resolved one — never null out a
    // previously-linked seller because a later re-scrape (e.g. the daily
    // cron re-check) transiently failed to extract seller data.
    const listingUpdate: Record<string, unknown> = {
      title: scrapedData.title,
      location: scrapedData.location,
      current_price: scrapedData.price,
      image_url: scrapedData.photoUrl || '',
      last_checked_at: new Date().toISOString(),
    };
    if (sellerId) {
      listingUpdate.seller_id = sellerId;
    }
    if (scrapedData.originalPostedAt) {
      listingUpdate.original_posted_at = scrapedData.originalPostedAt;
    }

    await supabase.from('listings').update(listingUpdate).eq('id', listingId);

    await supabase.from('listing_snapshots').insert({
      listing_id: listingId,
      price: scrapedData.price,
      title: scrapedData.title,
      description: '',
      photo_urls: scrapedData.photoUrl ? [scrapedData.photoUrl] : [],
      metadata: {},
    });

    await supabase.from('listings').update({
      description: scrapedData.description,
      specs: scrapedData.specs,
    }).eq('id', listingId);

    const aiOpinion = await generateAiOpinion(listing.source, {
      title: scrapedData.title,
      price: scrapedData.price,
      location: scrapedData.location,
      description: scrapedData.description,
      specs: scrapedData.specs,
    });

    if (aiOpinion) {
      await supabase.from('listings').update({
        ai_opinion_rating: aiOpinion.rating,
        ai_opinion_summary: aiOpinion.summary,
        ai_opinion_price_note: aiOpinion.priceNote,
        ai_opinion_watch_out: aiOpinion.watchOutFor,
        ai_opinion_model: aiOpinion.model,
        ai_opinion_generated_at: new Date().toISOString(),
      }).eq('id', listingId);
    }

    return new Response(
      JSON.stringify({ success: true, data: scrapedData }),
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
    console.error('Error in scrape-listing function:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process listing',
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
