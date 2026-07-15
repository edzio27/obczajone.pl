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
    };
  } catch (error) {
    console.error('Error scraping Otomoto:', error);
    return null;
  }
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
    console.error('Error creating seller:', insertError);
    return null;
  }

  return newSeller?.id ?? null;
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

    await supabase.from('listings').update(listingUpdate).eq('id', listingId);

    await supabase.from('listing_snapshots').insert({
      listing_id: listingId,
      price: scrapedData.price,
      title: scrapedData.title,
      description: '',
      photo_urls: scrapedData.photoUrl ? [scrapedData.photoUrl] : [],
      metadata: {},
    });

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
