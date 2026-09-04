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

// Only dealers ("PROFESSIONAL") get a seller profile. Both values are now
// confirmed against live listings: a dealer ad carries seller.type
// 'PROFESSIONAL', a private one 'PRIVATE'. Roughly three quarters of what we
// scrape is private, so the low share of listings with a seller is the rule
// working, not a gap - a person selling one car is not a business with a
// public profile, and giving them a page with reviews attached would be a
// different product with different obligations.
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
  /*
    Pola poniżej nie służą do wyświetlania. Są odciskiem palca egzemplarza:
    razem z marką, modelem i rocznikiem zawężają auto na tyle, żeby dało się
    rozpoznać, że dwa ogłoszenia z różnych miesięcy dotyczą tego samego
    samochodu - a przy okazji od razu poprawiają dobór ofert do porównania cen,
    bo dziś mediana bierze pod uwagę tylko rocznik, paliwo i przebieg.

    NIE MA TU VIN-U I NIE DA SIĘ GO STĄD WZIĄĆ. Otomoto szyfruje dokładnie te
    trzy pola, które identyfikowałyby pojazd - `vin`, `registration`
    i `date_registration` - i robi to per żądanie: dwa pobrania tej samej
    strony w odstępie trzech sekund zwracają inne wartości. To nie jest
    zamaskowany numer do odsłonięcia, tylko szyfrogram wymienialny na VIN przez
    ich własne API. Reszta parametrów jest jawna. Zanim ktoś spróbuje tego
    ponownie: to zostało sprawdzone na żywych ogłoszeniach 2 września 2026.
  */
  generation: string | null;
  engine_capacity: string | null;
  engine_power: string | null;
  gearbox: string | null;
  body_type: string | null;
  color: string | null;
  door_count: string | null;
};

function extractOtomotoParam(ad: any, keys: string[]): string | null {
  const params = ad?.parameters ?? ad?.details ?? [];
  if (!Array.isArray(params)) return null;
  for (const key of keys) {
    const found = params.find((p: any) => p?.key === key || p?.name === key);
    if (found) return found.value ?? found.displayValue ?? found.normalizedValue ?? null;
  }
  return null;
}

/*
  Marka i model z adresu ogloszenia - zapasowe zrodlo na wypadek, gdy
  __NEXT_DATA__ nie da sie odczytac albo Otomoto zmieni uklad parametrow.

  Nie jest to ozdoba: 955 z 1661 zapisanych ogloszen nie ma marki wlasnie
  dlatego, ze przy ich pobieraniu ta jedna sciezka zawiodla. Bez marki
  ogloszenie wypada ze statystyk obnizek - w bazie bylo 171 realnych obnizek,
  a liczylo sie 41. Adres ma te dane zawsze i przetrwa kazda zmiane strony:
  /osobowe/oferta/<marka-model>-ID<id>.html

  Marki trzymamy jawna lista, bo z samego sluga nie da sie zgadnac, gdzie
  konczy sie marka - "land-rover-range-rover-sport" to Land Rover, nie Land.
  Dlugie marki sprawdzamy pierwsze.
*/
/*
  Slug marki -> nazwa dokladnie taka, jaka juz jest w bazie. To nie kosmetyka:
  "mercedes-benz" zapisany jako "Mercedes Benz" zalozylby drugi, osobny model
  obok istniejacego "Mercedes-Benz" i rozbil jego statystyki na pol. Nazwy
  pochodza ze zrzutu marek faktycznie wystepujacych w listings.
*/
const OTOMOTO_BRANDS: Array<[string, string]> = [
  ['alfa-romeo', 'Alfa Romeo'], ['aston-martin', 'Aston Martin'],
  ['ds-automobiles', 'DS Automobiles'], ['harley-davidson', 'Harley-Davidson'],
  ['land-rover', 'Land Rover'], ['mercedes-benz', 'Mercedes-Benz'],
  ['great-wall', 'Great Wall'], ['rolls-royce', 'Rolls-Royce'],
  ['abarth', 'Abarth'], ['acura', 'Acura'], ['audi', 'Audi'], ['bentley', 'Bentley'],
  ['bmw', 'BMW'], ['buick', 'Buick'], ['byd', 'BYD'], ['cadillac', 'Cadillac'],
  ['cfmoto', 'CFMoto'], ['chery', 'Chery'], ['chevrolet', 'Chevrolet'],
  ['chrysler', 'Chrysler'], ['citroen', 'Citroën'], ['cupra', 'Cupra'],
  ['dacia', 'Dacia'], ['daewoo', 'Daewoo'], ['daihatsu', 'Daihatsu'],
  ['dodge', 'Dodge'], ['ducati', 'Ducati'], ['ferrari', 'Ferrari'], ['fiat', 'Fiat'],
  ['ford', 'Ford'], ['gmc', 'GMC'], ['honda', 'Honda'], ['hummer', 'Hummer'],
  ['hyundai', 'Hyundai'], ['infiniti', 'Infiniti'], ['isuzu', 'Isuzu'],
  ['iveco', 'Iveco'], ['jaguar', 'Jaguar'], ['jeep', 'Jeep'], ['kawasaki', 'Kawasaki'],
  ['kia', 'Kia'], ['lamborghini', 'Lamborghini'], ['lancia', 'Lancia'],
  ['lexus', 'Lexus'], ['lincoln', 'Lincoln'], ['lotus', 'Lotus'], ['man', 'MAN'],
  ['maserati', 'Maserati'], ['mazda', 'Mazda'], ['mclaren', 'McLaren'], ['mg', 'MG'],
  ['mini', 'MINI'], ['mitsubishi', 'Mitsubishi'], ['nissan', 'Nissan'],
  ['omoda', 'Omoda'], ['opel', 'Opel'], ['peugeot', 'Peugeot'], ['piaggio', 'Piaggio'],
  ['polestar', 'Polestar'], ['pontiac', 'Pontiac'], ['porsche', 'Porsche'],
  ['renault', 'Renault'], ['saab', 'Saab'], ['scania', 'Scania'], ['seat', 'Seat'],
  ['skoda', 'Skoda'], ['smart', 'Smart'], ['ssangyong', 'SsangYong'],
  ['subaru', 'Subaru'], ['suzuki', 'Suzuki'], ['tesla', 'Tesla'], ['toyota', 'Toyota'],
  ['volkswagen', 'Volkswagen'], ['volvo', 'Volvo'], ['xpeng', 'XPeng'],
  ['yamaha', 'Yamaha'],
].sort((a, b) => b[0].length - a[0].length);

/*
  Slug modelu z powrotem na nazwe. Dwa krotkie czlony obok siebie to jedno
  oznaczenie i lacza sie myslnikiem ("cx-3" -> "CX-3", tak jak w bazie stoi
  juz "CX-5" i "MX-5"); czlon dluzszy to slowo i dostaje spacje
  ("a6-avant" -> "A6 Avant", "seria-5" -> "Seria 5").
*/
function modelFromSlug(slug: string): string {
  const parts = slug.split('-').map((w) =>
    w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
  );
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const joined = parts[i - 1].length <= 3 && parts[i].length <= 3;
    out += (joined ? '-' : ' ') + parts[i];
  }
  return out;
}

/*
  Marka i model z adresu ogloszenia - zapasowe zrodlo na wypadek, gdy
  __NEXT_DATA__ nie da sie odczytac albo Otomoto zmieni uklad parametrow.

  Nie jest to ozdoba: 955 z 1661 zapisanych ogloszen nie ma marki wlasnie
  dlatego, ze przy ich pobieraniu ta jedna sciezka zawiodla. Bez marki
  ogloszenie wypada ze statystyk obnizek - w bazie bylo 171 realnych obnizek,
  a liczylo sie 41. Adres ma te dane zawsze i przetrwa kazda zmiane strony:
  /osobowe/oferta/<marka-model>-ID<id>.html

  Marki trzymamy jawna lista, bo z samego sluga nie da sie zgadnac, gdzie
  konczy sie marka - "land-rover-range-rover-sport" to Land Rover, nie Land.
  Dlugie marki sprawdzamy pierwsze.
*/
function specsFromUrl(url: string): { brand: string; model: string } | null {
  const match = url.split('?')[0].match(/\/oferta\/(.+?)-ID[A-Za-z0-9]+\.html/);
  if (!match) return null;
  const slug = match[1].toLowerCase();

  for (const [brandSlug, brandName] of OTOMOTO_BRANDS) {
    if (slug !== brandSlug && !slug.startsWith(brandSlug + '-')) continue;

    let rest = slug.slice(brandSlug.length).replace(/^-/, '');
    // "cupra-cupra-leon-st" - marka bywa powtorzona w czlonie modelu.
    if (rest === brandSlug || rest.startsWith(brandSlug + '-')) {
      rest = rest.slice(brandSlug.length).replace(/^-/, '');
    }
    if (!rest) return null;
    /*
      Sprzedajacy wpychaja w tytul cala specyfikacje, a Otomoto przenosi ja do
      sluga ("man-tgl-12-190-euro-6-kontener-winda-niski-przebieg"). Nazwa
      modelu ma najwyzej trzy czlony; dluzsze to tytul, nie model, i lepiej
      zostawic ogloszenie bez marki niz zalozyc strone modelu dla jednego auta.
    */
    if (rest.split('-').length > 3) return null;

    return { brand: brandName, model: modelFromSlug(rest) };
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
    generation: extractOtomotoParam(ad, ['generation']),
    engine_capacity: extractOtomotoParam(ad, ['engine_capacity']),
    engine_power: extractOtomotoParam(ad, ['engine_power']),
    gearbox: extractOtomotoParam(ad, ['gearbox']),
    body_type: extractOtomotoParam(ad, ['body_type']),
    color: extractOtomotoParam(ad, ['color']),
    door_count: extractOtomotoParam(ad, ['door_count']),
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
    let specs: OtomotoSpecs = {
      brand: null,
      model: null,
      year: null,
      mileage: null,
      fuel_type: null,
      generation: null,
      engine_capacity: null,
      engine_power: null,
      gearbox: null,
      body_type: null,
      color: null,
      door_count: null,
    };
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

    /*
      Ostatnia deska ratunku dla marki i modelu. Wszystkie powyzsze sciezki
      czytaja strone, wiec kazda z nich moze zawiesc naraz - a wtedy ogloszenie
      zapisuje sie bez marki i na zawsze wypada ze statystyk obnizek. Adres mamy
      zawsze, bo to on byl wejsciem do tej funkcji.
    */
    if (!specs.brand || !specs.model) {
      const fromUrl = specsFromUrl(url);
      if (fromUrl) {
        specs.brand = specs.brand || fromUrl.brand;
        specs.model = specs.model || fromUrl.model;
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
    rating: { type: 'number' },
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
  market: MarketContext | null;
};

type MarketContext = {
  medianPrice: number;
  sampleSize: number;
  percentVsMedian: number;
  criteria: string;
};

// Progi lustrzane wobec lib/price-comparison.ts po stronie aplikacji. Logika jest
// tu powtorzona, bo edge functions dzialaja na Deno i nie wspoldziela modulow z
// aplikacja Next - przy zmianie progow trzeba poprawic oba miejsca.
const MARKET_MIN_SAMPLE = 5;
const MARKET_MAX_QUARTILE_SPREAD = 2;

function parseSpecNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function quantileOf(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const next = sorted[base + 1];
  return next !== undefined ? sorted[base] + (pos - base) * (next - sorted[base]) : sorted[base];
}

/**
 * Mediana cen porownywalnych ofert, wstrzykiwana do promptu. Bez niej model
 * ocenia cene wylacznie "na oko" i kazde ogloszenie dostaje podobna note.
 *
 * Cala funkcja jest osłonieta try/catch: opinia AI jest opcjonalna i jej brak
 * nigdy nie moze wywrocic scrapowania.
 */
async function fetchMarketContext(
  supabase: any,
  listingId: string,
  source: string,
  specs: Record<string, unknown>,
  price: number
): Promise<MarketContext | null> {
  if (source !== 'otomoto' || !(price > 0)) return null;

  const brand = typeof specs.brand === 'string' ? specs.brand.trim() : '';
  const model = typeof specs.model === 'string' ? specs.model.trim() : '';
  if (!brand || !model) return null;

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('current_price, specs')
      .eq('source', 'otomoto')
      .neq('id', listingId)
      .gt('current_price', 0)
      .filter('specs->>brand', 'eq', brand)
      .filter('specs->>model', 'eq', model)
      .limit(500);

    if (error || !data || data.length === 0) return null;

    const subjectYear = parseSpecNumber(specs.year);
    const subjectMileage = parseSpecNumber(specs.mileage);
    const subjectFuel = typeof specs.fuel_type === 'string' ? specs.fuel_type.toLowerCase() : null;

    const candidates = data.map((row: any) => ({
      price: Number(row.current_price),
      year: parseSpecNumber(row.specs?.year),
      mileage: parseSpecNumber(row.specs?.mileage),
      fuel: typeof row.specs?.fuel_type === 'string' ? row.specs.fuel_type.toLowerCase() : null,
    }));

    const levels = [
      {
        label: `rocznik ±2 lata, ten sam rodzaj paliwa, przebieg ±40%`,
        ok: (c: any) =>
          subjectYear != null && c.year != null && Math.abs(c.year - subjectYear) <= 2 &&
          subjectFuel && c.fuel === subjectFuel &&
          subjectMileage != null && c.mileage != null && subjectMileage > 0 &&
          Math.abs(c.mileage - subjectMileage) / subjectMileage <= 0.4,
      },
      {
        label: `rocznik ±2 lata, ten sam rodzaj paliwa`,
        ok: (c: any) =>
          subjectYear != null && c.year != null && Math.abs(c.year - subjectYear) <= 2 &&
          subjectFuel && c.fuel === subjectFuel,
      },
      {
        label: `rocznik ±3 lata`,
        ok: (c: any) =>
          subjectYear != null && c.year != null && Math.abs(c.year - subjectYear) <= 3,
      },
    ];

    for (const level of levels) {
      const matched = candidates.filter(level.ok);
      if (matched.length < MARKET_MIN_SAMPLE) continue;

      const prices = matched.map((c: any) => c.price).sort((a: number, b: number) => a - b);
      const mid = Math.floor(prices.length / 2);
      const medianPrice =
        prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];

      const p25 = quantileOf(prices, 0.25);
      const p75 = quantileOf(prices, 0.75);
      if (p25 > 0 && p75 / p25 > MARKET_MAX_QUARTILE_SPREAD) break;

      return {
        medianPrice,
        sampleSize: matched.length,
        percentVsMedian: ((price - medianPrice) / medianPrice) * 100,
        criteria: `${brand} ${model}, ${level.label}`,
      };
    }

    return null;
  } catch (e) {
    console.error('fetchMarketContext failed; continuing without market data:', e);
    return null;
  }
}

function buildAiOpinionPrompt(source: 'otomoto' | 'otodom', data: AiOpinionInput): string {
  const specsLines = Object.entries(data.specs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const kindLabel = source === 'otomoto' ? 'ogłoszenia samochodowego' : 'ogłoszenia nieruchomości';
  const sourceLabel = source === 'otomoto' ? 'Otomoto' : 'Otodom';

  const m = data.market;
  const marketBlock = m
    ? `
Porównanie z rynkiem (policzone z naszej bazy, NIE zgadywane):
- mediana ceny podobnych ofert: ${Math.round(m.medianPrice)} PLN
- ta oferta jest o ${Math.abs(m.percentVsMedian).toFixed(0)}% ${m.percentVsMedian < 0 ? 'tańsza' : 'droższa'} od mediany
- podstawa: ${m.sampleSize} ofert, kryteria: ${m.criteria}
`
    : '';

  const priceGuidance = m
    ? `Dane o cenie powyżej są policzone z realnych ofert, więc możesz o nich pisać wprost jako o faktach — podaj różnicę w procentach i odnieś się do niej w price_note. Jeżeli oferta jest wyraźnie tańsza od mediany (ponad 15%), napisz to jasno i zasugeruj sprawdzenie stanu technicznego oraz historii pojazdu przed zakupem; nie przypisuj przy tym sprzedającemu złych intencji.`
    : `Nie masz danych o cenach innych ofert tego modelu, więc o cenie pisz ostrożnie i nie sugeruj, że jest zawyżona ani zaniżona.`;

  return `Poniżej dane ${kindLabel} ze strony ${sourceLabel}:

Tytuł: ${data.title}
Cena: ${data.price} PLN
Lokalizacja: ${data.location}
Parametry:
${specsLines || '(brak dodatkowych parametrów)'}

Opis:
${data.description || '(brak opisu)'}
${marketBlock}
Napisz krótką, pierwszą opinię o tym ogłoszeniu po polsku, na podstawie powyższych danych (nie masz dostępu do zdjęć).

${priceGuidance}

WAŻNE: nigdy nie formułuj stanowczych zarzutów wobec sprzedającego ani ogłoszenia. Punkty "na co zwrócić uwagę" pisz wyłącznie jako ostrożne pytania lub sugestie do zweryfikowania osobiście (np. "może warto dopytać o historię serwisową"), nigdy jako twierdzenia (np. nie pisz "przebieg wygląda podejrzanie").

Zwróć:
- rating: ocena 1.0-5.0 z dokładnością do jednego miejsca po przecinku (np. 3.6, 4.2) — unikaj okrągłych wartości typu 3.0 czy 4.0; jeżeli masz dane rynkowe, niech ocena je odzwierciedla: cena zbliżona do mediany to ocena wysoka, cena wyraźnie odstająca w dół to ocena wyraźnie niższa, bo zwykle coś za nią stoi. Oceny różnych ogłoszeń mają się od siebie realnie różnić — ocena, którą dostaje każde ogłoszenie, jest bezwartościowa
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
      rating: Math.min(5, Math.max(1, Math.round(parsed.rating * 10) / 10)),
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

    const market = await fetchMarketContext(
      supabase,
      listingId,
      listing.source,
      scrapedData.specs as Record<string, unknown>,
      scrapedData.price
    );

    const aiOpinion = await generateAiOpinion(listing.source, {
      title: scrapedData.title,
      price: scrapedData.price,
      location: scrapedData.location,
      description: scrapedData.description,
      specs: scrapedData.specs,
      market,
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
