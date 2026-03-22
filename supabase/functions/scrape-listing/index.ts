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
    const response = await fetch(url);
    const html = await response.text();

    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
    const priceMatch = html.match(/data-price="(\d+)"/);
    const locationMatch = html.match(/<span[^>]*location[^>]*>(.*?)<\/span>/);

    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
    const price = priceMatch ? parseInt(priceMatch[1]) : 0;
    const location = locationMatch ? locationMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    const photoMatches = html.matchAll(/data-lazy="(https:\/\/[^"]*otomoto[^"]*\.jpg)"/g);
    const photoUrls: string[] = [];
    for (const match of photoMatches) {
      if (photoUrls.length < 10) {
        photoUrls.push(match[1]);
      }
    }

    const descMatch = html.match(/<div[^>]*description[^>]*>(.*?)<\/div>/s);
    const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    return {
      title,
      price,
      location,
      description: description.substring(0, 5000),
      photoUrls,
      metadata: {},
    };
  } catch (error) {
    console.error('Error scraping Otomoto:', error);
    return null;
  }
}

async function scrapeOtodom(url: string) {
  try {
    const response = await fetch(url);
    const html = await response.text();

    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
    const priceMatch = html.match(/"price":\s*(\d+)/);
    const locationMatch = html.match(/"location":\s*"([^"]+)"/);

    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
    const price = priceMatch ? parseInt(priceMatch[1]) : 0;
    const location = locationMatch ? locationMatch[1] : '';

    const photoMatches = html.matchAll(/"(https:\/\/[^"]*otodom[^"]*\.jpg)"/g);
    const photoUrls: string[] = [];
    for (const match of photoMatches) {
      if (photoUrls.length < 10) {
        photoUrls.push(match[1]);
      }
    }

    const descMatch = html.match(/<div[^>]*description[^>]*>(.*?)<\/div>/s);
    const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    return {
      title,
      price,
      location,
      description: description.substring(0, 5000),
      photoUrls,
      metadata: {},
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

    const { listingId }: RequestBody = await req.json();

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

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
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', listingId);

    await supabase.from('listing_snapshots').insert({
      listing_id: listingId,
      price: scrapedData.price,
      title: scrapedData.title,
      description: scrapedData.description,
      photo_urls: scrapedData.photoUrls,
      metadata: scrapedData.metadata,
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
      JSON.stringify({ error: error.message }),
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
