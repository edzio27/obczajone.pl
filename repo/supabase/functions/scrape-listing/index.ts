import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  listingId: string;
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
    };
  } catch (error) {
    console.error('Error scraping Otodom:', error);
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
    const { listingId, testUrl }: RequestBody & { testUrl?: string } = body;

    // Test mode - bezpośrednie testowanie URL
    if (testUrl) {
      let scrapedData;
      if (testUrl.includes('otomoto')) {
        scrapedData = await scrapeOtomoto(testUrl);
      } else if (testUrl.includes('otodom')) {
        scrapedData = await scrapeOtodom(testUrl);
      }

      return new Response(
        JSON.stringify({ success: true, data: scrapedData, test: true }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
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

    let scrapedData;
    if (listing.source === 'otomoto') {
      scrapedData = await scrapeOtomoto(listing.url);
    } else if (listing.source === 'otodom') {
      scrapedData = await scrapeOtodom(listing.url);
    }

    if (!scrapedData) {
      throw new Error('Failed to scrape listing');
    }

    await supabase
      .from('listings')
      .update({
        title: scrapedData.title,
        location: scrapedData.location,
        current_price: scrapedData.price,
        image_url: scrapedData.photoUrl || '',
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', listingId);

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
    console.error('Error in scrape-listing function:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
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
